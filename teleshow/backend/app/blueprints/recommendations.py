# Written by Moses Pierre
from flask import Blueprint, request, jsonify
import tmdbsimple as tmdb
import torch.nn.functional as F  # Enabler of machine learning. Allows for the dot
from app.extensions import cache, limiter, get_db, get_model
from app.blueprints.search import get_watch_providers, PLATFORM_ID_MAP
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Thread, Lock
from ratelimit import limits, sleep_and_retry


recommendations_bp = Blueprint("recommendations", __name__)

# Points the default collection to users collection
# Here for user recommendations
users_ref = get_db().collection("users-test")


def make_rec_cache_key():  # Recommendations' POST method means url isn't unique. I had to make a unique key to cache recs.
    data = request.get_json()
    # Create a string representation of the important parts of the request using f-string
    key_data = f"{data.get('id')}-{data.get('type')}-{data.get('genre_ids')}-{data.get('keyword_ids')}"
    return key_data


# Using this function I can cache results that Ive already gotten
# Reduces API calls
@cache.memoize(3600)
def get_media_details(media_id, media_type):
    media = tmdb.Movies(media_id) if media_type == "movie" else tmdb.TV(media_id)
    return media.info(append_to_response="keywords")


# FUNCTION FOR CREATING POOL FOR RECOMMENDATIONS
# CORE ALGORITHM FOR SEARCHING TMDB DISCOVER
# GETS RECOMMENDATIONS BY SEARCHING USING SPECIFIC DATA FROM SOURCE
@sleep_and_retry
@limits(calls=50, period=5)
@cache.memoize(3600)
def create_pool_with_discover(
    media_genres,
    media_keywords,
    media_producers,
    media_type,
    release_year=None,
    vote_average=None,
    media_id=None,
    language="en",
):
    discover = tmdb.Discover()
    discover_results = []
    seen_ids = set()
    # These locks protect the editing of either the seen_id set or discover results
    # In each of the threads respective functions, if they try to edit either while another thread has the lock because their setting it in their own function, the last thread to try to edit it is forced to wait.
    results_lock = Lock()
    seen_ids_lock = Lock()
    if media_id:
        seen_ids.add(f"{media_id}-{media_type}")
    base_params = {
        "with_original_language": language,
        "without_genres": "99,10770",  # Excludes documentaries and TV movies
        "vote_count.gte": 75,
        "sort_by": "popularity.desc",
    }
    # Sends the properties of the media through discover endpoint
    if media_genres:
        base_params["with_genres"] = "|".join(map(str, media_genres))

    if vote_average:
        base_params["vote_average.gte"] = max(vote_average - 1.5, 5.5)

    if len(media_producers) > 0:
        base_params["with_companies"] = "|".join(map(str, media_producers))

    if release_year:
        year = int(release_year)
        if media_type == "movie":
            base_params["primary_release_date.gte"] = f"{year-8}-01-01"
            base_params["primary_release_date.lte"] = f"{year+8}-12-31"
        else:  # TV shows
            base_params["first_air_date.gte"] = f"{year-8}-01-01"
            base_params["first_air_date.lte"] = f"{year+8}-12-31"

    try:
        # Start initial search with genres and producers
        def genre_search():
            genre_results = []
            for page in range(1, 2):
                params = base_params.copy()
                params["page"] = page
                try:
                    results = (
                        discover.movie(**params)
                        if media_type == "movie"
                        else discover.tv(**params)
                    )

                    for r in results.get("results", []):
                        r["media_type"] = media_type
                        unique_key = f"{r['id']}-{media_type}"

                        # Makes sure that only one thread can set seen ids at a time
                        with seen_ids_lock:
                            if unique_key not in seen_ids:
                                seen_ids.add(unique_key)
                                genre_results.append(r)
                except Exception as e:
                    print(f"Error in genre search: {e}")
                # Makes sure only one thread can add to results at a time
                with results_lock:
                    discover_results.extend(genre_results)
                print(f"Added {len(genre_results)} genre-based results")

        # Then keyword search
        def keyword_search():
            if not media_keywords:
                return

            keyword_results = []
            # Using only the top five keywords
            keyword_params = {
                "with_original_language": language,
                "with_keywords": "|".join(map(str, media_keywords[:5])),
                "vote_count.gte": 50,
                "sort_by": "popularity.desc",
            }

            for page in range(1, 3):
                keyword_params["page"] = page
                try:
                    results = (
                        discover.movie(**keyword_params)
                        if media_type == "movie"
                        else discover.tv(**keyword_params)
                    )

                    for r in results.get("results", []):
                        r["media_type"] = media_type
                        unique_key = f"{r['id']}-{media_type}"
                        with seen_ids_lock:
                            if unique_key not in seen_ids:
                                seen_ids.add(unique_key)
                                keyword_results.append(r)
                except Exception as keyword_error:
                    print(f"Error with keyword batch: {str(keyword_error)}")
                    continue

            with results_lock:
                discover_results.extend(keyword_results)
            print(f"Added {len(keyword_results)} keyword-based results")

        def producer_search():
            if not media_producers:
                return
            producer_results = []
            producer_params = {
                "with_original_language": language,
                "with_companies": "|".join(map(str, media_producers)),
                "vote_count.gte": 50,
                "sort_by": "vote_count.desc",
            }
            for page in range(1, 3):
                producer_params["page"] = page
                try:
                    results = (
                        discover.movie(**producer_params)
                        if media_type == "movie"
                        else discover.tv(**producer_params)
                    )

                    for r in results.get("results", []):
                        r["media_type"] = media_type
                        unique_key = f"{r['id']}-{media_type}"
                        with seen_ids_lock:
                            if unique_key not in seen_ids:
                                seen_ids.add(unique_key)
                                producer_results.append(r)
                except Exception as producer_error:
                    print(f"Error with producer query: {str(producer_error)}")
                    continue
            with results_lock:
                discover_results.extend(producer_results)
            print(f"Added {len(producer_results)} producer-based results")

        # If there aren't enough results get some high quality (high average vote score) content to fill in the space
        def quality_search():
            quality_results = []
            quality_params = {
                "with_original_language": language,
                "vote_average.gte": 7.5,
                "vote_count.gte": 300,
                "sort_by": "vote_average.desc",
            }

            if media_genres and len(media_genres) > 0:
                # Uses primary genre for matching
                quality_params["with_genres"] = str(media_genres[0])

            for page in range(1, 2):
                quality_params["page"] = page
                try:
                    results = (
                        discover.movie(**quality_params)
                        if media_type == "movie"
                        else discover.tv(**quality_params)
                    )

                    for r in results.get("results", []):
                        r["media_type"] = media_type
                        unique_key = f"{r['id']}-{media_type}"
                        with seen_ids_lock:
                            if unique_key not in seen_ids:
                                seen_ids.add(unique_key)
                                quality_results.append(r)
                except Exception as quality_error:
                    print(f"Error with quality query: {str(quality_error)}")
                    continue
            with results_lock:
                discover_results.extend(quality_results)
            print(f"Added {len(quality_results)} quality-based results")

        threads = []
        genre_thread = Thread(target=genre_search)
        genre_thread.start()
        threads.append(genre_thread)

        # Runs keyword search if keywords are available
        if media_keywords:
            keyword_thread = Thread(target=keyword_search)
            keyword_thread.start()
            threads.append(keyword_thread)

        # Runs producer search if producers are available
        if media_producers:
            producer_thread = Thread(target=producer_search)
            producer_thread.start()
            threads.append(producer_thread)

        # Waits for all threads to complete
        for thread in threads:
            thread.join()

        # Checks if we need quality search as a fallback
        if len(discover_results) < 15:
            quality_thread = Thread(target=quality_search)
            quality_thread.start()
            quality_thread.join()

        # Scores results before returning
        scored_results = []
        for item in discover_results:
            # Calculates base score from popularity and vote average
            base_score = (
                item.get("popularity", 0) * 0.6 + item.get("vote_average", 0) * 0.4
            )

            # Genre matching bonus
            genre_bonus = 0
            if media_genres and "genre_ids" in item:
                common_genres = set(media_genres).intersection(
                    set(item.get("genres", []))
                )
                genre_bonus = len(common_genres) * 5  # 5 points per matching genre

            # Recency bonus for newer content
            recency_bonus = 0
            item_date = item.get("release_date") or item.get("first_air_date")
            if item_date and release_year:
                try:
                    item_year = int(item_date[:4])
                    target_year = int(release_year)
                    year_diff = abs(item_year - target_year)
                    if year_diff <= 3:
                        recency_bonus = 15 - (year_diff * 3)
                except ValueError:
                    pass

            final_score = base_score + genre_bonus + recency_bonus

            # Adds score to the item
            item["relevance_score"] = final_score
            scored_results.append(item)

        # Sorts by relevance score
        sorted_results = sorted(
            scored_results, key=lambda x: x.get("relevance_score", 0), reverse=True
        )
        return sorted_results[:100]
    except Exception as e:
        print(f"Error using Discover endpoint: {str(e)}")
        return []


# COMPARES TWO OVERVIEWS AND TAGLINES
@cache.memoize(3600)
def calculate_similarity(media_title, media_overview, recommendations_list):
    # Turns text into numerical vector representations
    rec_titles = [
        rec.get("title", "") or rec.get("name", "") for rec in recommendations_list
    ]
    rec_overviews = [rec.get("overview", "") for rec in recommendations_list]
    # Performs consine calculation to find how similiar text segments are. 1 = identical and close to 0 means different
    # Encode all the overviews
    # Title similarity
    title_embeddings = get_model().encode(
        [media_title] + rec_titles, convert_to_tensor=True, batch_size=16
    )
    title_source = title_embeddings[0].unsqueeze(0)
    title_targets = title_embeddings[1:]
    title_similarities = F.cosine_similarity(title_source, title_targets).tolist()

    # Overview similarity
    overview_embeddings = get_model().encode(
        [media_overview] + rec_overviews, convert_to_tensor=True, batch_size=16
    )
    overview_source = overview_embeddings[0].unsqueeze(0)
    overview_targets = overview_embeddings[1:]
    overview_similarities = F.cosine_similarity(
        overview_source, overview_targets
    ).tolist()

    combined_similarities = [
        (title_similarities[i] * 0.4) + (overview_similarities[i] * 0.6)
        for i in range(len(title_similarities))
    ]

    return combined_similarities


# GENERAL RECOMMENDATIONS
@recommendations_bp.route("/recommendations", methods=["POST"])
@limiter.limit("50 per 5 seconds")
@cache.cached(timeout=86400, make_cache_key=make_rec_cache_key)
def get_recommendations():  # Unused data for better recommendations.
    data = request.get_json()
    media_id = int(data.get("id"))
    media_title = data.get("title")
    media_type = data.get("type")
    release_year = data.get("release_year")
    if release_year:
        release_year = str(release_year)
    media_overview = data.get("overview", "No overview available")
    media_vote_average = data.get("vote_average")
    if media_vote_average:
        media_vote_average = float(media_vote_average)
    media_language = data.get("language", "en")
    producer_ids = data.get("producer_ids")
    if isinstance(producer_ids, str):
        media_producer_ids = producer_ids.split(",")
        if len(media_producer_ids) > 0:
            media_producer_ids = list(map(int, media_producer_ids))
        else:
            media_producer_ids = []
    else:
        media_producer_ids = producer_ids or []
    # Converts content to int and back to list
    genre_ids = data.get("genre_ids", "")
    if isinstance(genre_ids, str):
        media_genre_ids = genre_ids.split(",")
    else:
        media_genre_ids = genre_ids or []
    keyword_ids = data.get("keyword_ids", "")
    if isinstance(keyword_ids, str):
        media_keyword_ids = keyword_ids.split(",") or []
    else:
        media_keyword_ids = keyword_ids or []

    recommendations = []
    unique_recs = []
    filtered_recs = []
    seen = set()
    genre_sim = 0
    text_sim = 0
    keyword_sim = 0
    popularity_factor = 0

    recommendations.extend(
        create_pool_with_discover(
            media_genre_ids,
            media_keyword_ids,
            media_producer_ids,
            media_type,
            release_year,
            media_vote_average,
            media_id,
            media_language,
        )
    )

    for rec in recommendations:  # Prevent duplicate recommendations
        unique_key = f"{rec.get('id')}-{rec.get('media_type')}"
        if (
            unique_key not in seen and rec.get("id") != media_id
        ):  # Make sure we dont get the original media in recommendations
            seen.add(unique_key)
            unique_recs.append(rec)
    unique_recs = [
        rec for rec in unique_recs if rec.get("popularity", 0) > 1.0
    ]  # Remove recommendations with low popularity

    recs_to_compare = [rec for rec in unique_recs if rec.get("overview")]

    similarity_scores = calculate_similarity(
        media_title, media_overview, recs_to_compare
    )

    for i, rec in enumerate(recs_to_compare):
        text_sim = similarity_scores[i]
        rec_media_info = get_media_details(rec.get("id"), rec.get("media_type"))

        # For the movie candidate, remove if their languages don't match
        if (
            rec_media_info.get("original_language") != media_language
            and rec_media_info.get("media_type") == "movie"
        ):
            continue

        key = "keywords" if rec.get("media_type") == "movie" else "results"
        rec_keywords = [
            k["id"] for k in rec_media_info.get("keywords", []).get(key, [])
        ] or []  # Keywords is double nested in the response.

        rec_genres = [r.get("id") for r in rec_media_info.get("genres")] or []

        # Genre similarity check
        # Jaccard Similarity = |Intersection| / |Union|
        # Intersection is the elements that appear in both
        # Union is all the elements
        if not media_genre_ids or not rec_genres:
            genre_sim = 0.1
        else:
            common_genres = set(media_genre_ids).intersection(set(rec_genres))
            total_genres = set(media_genre_ids).union(set(rec_genres))
            genre_sim = len(common_genres) / len(total_genres) if total_genres else 0
            if common_genres:
                min_score = min(0.2 + (len(common_genres) * 0.1), 0.6)
                genre_sim = max(genre_sim, min_score)

        if media_keyword_ids and rec_keywords:  # Keyword similarity check
            common_keywords = set(media_keyword_ids).intersection(set(rec_keywords))
            total_keywords = set(media_keyword_ids).union(set(rec_keywords))
            keyword_sim = (
                len(common_keywords) / len(total_keywords) if total_keywords else 0
            )
            if common_keywords:
                keyword_sim = max(keyword_sim, 0.3)
        else:
            keyword_sim = 0

        genre_sim = min(genre_sim, 1.0)
        text_sim = min(text_sim, 1.0)
        keyword_sim = min(keyword_sim, 1.0)
        popularity_factor = min(rec_media_info.get("popularity", 0) / 100, 1.0)

        total_score = (
            (genre_sim * 0.35)  # Genre importance: 35%
            + (text_sim * 0.30)  # Text similarity importance: 30%
            + (keyword_sim * 0.25)  # Keyword importance: 25%
            + (popularity_factor * 0.10)  # Popularity importance: 10%
        )

        total_score = min(total_score * 10, 10)

        filtered_recs.append(  # Recommendations are given weight based on importance
            {"rec": rec, "score": total_score}
        )

    filtered_recs = sorted(filtered_recs, key=lambda x: -x["score"])
    results = [item["rec"] for item in filtered_recs[:24]]
    if results:
        return jsonify({"recommendations": results or []})
    else:
        return jsonify(
            {"recommendations": tmdb.Movies().popular()["results"][:16] or []}
        )


@recommendations_bp.route("/user-recommendations", methods=["GET"])
@cache.cached(query_string=True, timeout=600)
@limiter.limit("10 per 5 seconds")
def get_user_recommendations():
    user_id = request.args.get("user_id")
    platforms = request.args.get("platforms", "all")
    platform_list = platforms.split(",") if platforms != "all" else ["all"]
    if not user_id:
        return jsonify({"error": "User must be logged in"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        # Get the user interests
        interests_refs = [
            user_ref.collection("interests").document("genres"),
            user_ref.collection("interests").document("keywords"),
            user_ref.collection("interests").document("production_companies"),
        ]

        interests_docs = [ref.get() for ref in interests_refs]

        # Get ids of media already in watchlists
        seen_media_ids = []
        seen_movie_ids = []
        seen_tv_ids = []
        watchlists = []
        followed_docs = user_ref.collection("followed_media").stream()
        watchlist_docs = user_ref.collection("watchlists").stream()
        # Get the watchlist ids from firebase
        for doc in watchlist_docs:
            watchlists.append({"id": doc.id})

        # Followed media will not show up in recommendations
        for doc in followed_docs:
            media = doc.to_dict()
            seen_media_ids.append(
                {
                    "media_id": media.get("media_id"),
                    "media_type": media.get("media_type"),
                }
            )

        # Use the watchlist ids to get the media for each watchlist
        for item in watchlists:
            id = item.get("id")
            media_docs = (
                user_ref.collection("watchlists")
                .document(id)
                .collection("media")
                .stream()
            )
            # The media ids from the media collection
            for doc in media_docs:
                media_data = doc.to_dict()
                seen_media_ids.append(
                    {
                        "media_id": media_data.get("media_id"),
                        "media_type": media_data.get("media_type"),
                    }
                )

        for item in seen_media_ids:
            if item.get("media_type") == "movie":
                seen_movie_ids.append(item.get("media_id"))
            else:
                seen_tv_ids.append(item.get("media_id"))

        # Get the user interests data from the collection
        user_genres = (
            [g.get("id") for g in interests_docs[0].to_dict().get("items", [])]
            if interests_docs[0].exists
            else []
        )
        user_keywords = (
            [k.get("id") for k in interests_docs[1].to_dict().get("items", [])]
            if interests_docs[1].exists
            else []
        )
        user_companies = (
            [c.get("id") for c in interests_docs[2].to_dict().get("items", [])]
            if interests_docs[2].exists
            else []
        )

        # Passes to the expand pool function to get search results for interests
        # Same function used to make the recommendation pool bigger in general recommendations
        movie_results = create_pool_with_discover(
            user_genres, user_keywords, user_companies, "movie"
        )
        tv_results = create_pool_with_discover(
            user_genres, user_keywords, user_companies, "tv"
        )

        filtered_movie_results = [
            movie for movie in movie_results if movie.get("id") not in seen_movie_ids
        ]

        filtered_tv_results = [
            tv for tv in tv_results if tv.get("id") not in seen_tv_ids
        ]

        if "all" not in platform_list:
            all_platform_ids = set()
            for platform in platform_list:
                platform_ids = PLATFORM_ID_MAP.get(platform.lower(), [])
                all_platform_ids.update(platform_ids)

            filtered_movies = []
            movie_slice = filtered_movie_results[:24]
            with ThreadPoolExecutor(max_workers=5) as executor:
                # Map each movie to a future that fetches its providers
                future_to_movie = {
                    executor.submit(get_watch_providers, movie["id"], "movie"): i
                    for i, movie in enumerate(movie_slice)
                }
                for future in as_completed(future_to_movie):
                    i = future_to_movie[future]
                    try:
                        provider_ids = future.result(timeout=5)
                        # Check if any provider matches any platform ID
                        if any(pid in all_platform_ids for pid in provider_ids):
                            filtered_movies.append(movie_slice[i])
                    except Exception as e:
                        print(f"Provider fetch failed for movie: {e}")

            filtered_movie_results = filtered_movies

            filtered_tv = []
            tv_slice = filtered_tv_results[:24]
            with ThreadPoolExecutor(max_workers=5) as executor:
                # Map each TV show to a future that fetches its providers
                future_to_tv = {
                    executor.submit(get_watch_providers, tv["id"], "tv"): i
                    for i, tv in enumerate(tv_slice)
                }
                # Process results as they complete
                for future in as_completed(future_to_tv):
                    i = future_to_tv[future]
                    try:
                        provider_ids = future.result(timeout=5)
                        if any(pid in all_platform_ids for pid in provider_ids):
                            filtered_tv.append(tv_slice[i])
                    except Exception as e:
                        print(f"Provider fetch failed for TV show: {e}")

            filtered_tv_results = filtered_tv

        sorted_movie_results = sorted(
            filtered_movie_results, key=lambda x: x.get("popularity", 0), reverse=True
        )
        sorted_tv_results = sorted(
            filtered_tv_results, key=lambda x: x.get("popularity", 0), reverse=True
        )

        return jsonify(
            {"movie_recs": sorted_movie_results, "tv_recs": sorted_tv_results}
        )

    except Exception as e:
        print(f"Error getting user recommendations: {str(e)}")
        return jsonify({"error": str(e)})
