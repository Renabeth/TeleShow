# Written by Moses Pierre
import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from flask import (
    Flask,
    request,
    jsonify,
    redirect,
)  # Allows for the creating of API endpoints
from flask_cors import CORS  # CORS allows for cross-origin requests
from flask_caching import Cache  # For caching API Queries
from flask_limiter import Limiter  # Rate Limiting
from flask_limiter.util import get_remote_address
import requests  # For sending requests to urls
import json  # For Parsing JSON files (Flask uses its own jsonify function)
import os  # Used to find file paths
import datetime
import torch
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Generates a numerical representation (embedding) for the entire sentence or paragraph, enabling it to measure semantic similarity efficiently.
from sentence_transformers import SentenceTransformer

app = Flask(__name__)  # Initializes Flask

CORS(app, origins=["http://localhost:3000"])  # Initializes CORS

# Initializes Cache with a default ttl of 30 minutes
cache = Cache(
    app,
    config={
        "CACHE_TYPE": "SimpleCache",
        "CACHE_THRESHOLD": 2000,
        "CACHE_DEFAULT_TIMEOUT": 3600,
    },
)

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri="memory://",
    strategy="fixed-window",
)

TMDB_RATE = "50 per 10 seconds"  # TMDB's official limit
WATCHMODE_RATE = "100 per minute"  # Watchmode's limit
INTERNAL_RATE = "200 per minute"

base_url1 = "https://api.watchmode.com/v1"  # Base API urls used to create full urls for API calls.
image_url = "https://image.tmdb.org/t/p/w500"  # Base Image urls

tmdb.API_KEY = os.getenv(
    "PY_TMDB_API_KEY"
)  # Sets the API key using the tmdbsimple library
api_key1 = os.getenv("PY_WATCHMODE_API_KEY")  # Saves the watchmode API to a variable


model = SentenceTransformer(
    "all-MiniLM-L12-v2"
)  # Sets the pre-trained learning model for Sentence Transformer

script_dir = os.path.dirname(os.path.abspath(__file__))
firebase_key = os.path.join(script_dir, "Resources", "teleshow-firebase.json")

cred = credentials.Certificate(firebase_key)  # Firebase initialization
firebase_admin.initialize_app(cred)
db = firestore.client()
users_ref = db.collection("users-test")


@cache.memoize(3600)  # Initializes cache for function
@limiter.limit(WATCHMODE_RATE)
def watchmode_search(tmdb_id, type):  # Function takes tmdb id and type (movie or tv)
    url = f"{base_url1}/search/"  # Endpoint url building
    if type == "movie":
        params = {
            "apiKey": api_key1,
            "search_field": "tmdb_movie_id",  # If type is 'movie', search field is set to the tmdb_movie_id endpoint
            "search_value": tmdb_id,
        }  # The value being passed

        response = requests.get(url, params=params)  # Request made to API endpoint

        if (
            response.status_code == 200
        ):  # Watchmode code 200 means request was successful
            results = response.json().get("title_results", [])

            if results and isinstance(
                results, list
            ):  # Iterates through the results given and gets data under ID key from results
                title_id = results[0].get("id")
                sources_url = f"{base_url1}/title/{title_id}/sources/"  # ID key used to query the sources endpoint
                sources_params = {"apiKey": api_key1}
                sources_response = requests.get(sources_url, params=sources_params)

                if sources_response.status_code == 200:
                    sources = sources_response.json()
                    us_sources = [
                        source
                        for source in sources
                        if source.get("region", "").upper() == "US"
                    ]
                    return sorted(
                        us_sources, key=lambda x: x["name"]
                    )  # If all is successful, dictionary of sources are returned
                else:
                    print(
                        f"Watchmode source API Error: {sources_response.status_code} - {sources_response.text}"
                    )
                    cache.delete_memoized(watchmode_search, tmdb_id, type)
                    return []
            else:
                cache.delete_memoized(watchmode_search, tmdb_id, type)
                return []
        else:
            print(f"WatchMode API Error: {response.status_code} - {response.text}")
            cache.delete_memoized(watchmode_search, tmdb_id, type)
            return []

    elif type == "tv":
        params = {
            "apiKey": api_key1,
            "search_field": "tmdb_tv_id",  # If type is 'tv', search field is set to the tmdb_tv_id endpoint
            "search_value": tmdb_id,
        }
        response = requests.get(url, params=params)

        if response.status_code == 200:
            results = response.json().get("title_results", [])
            if results and isinstance(results, list):
                title_id = results[0].get("id")
                sources_url = f"{base_url1}/title/{title_id}/sources/"
                sources_params = {"apiKey": api_key1}
                sources_response = requests.get(sources_url, params=sources_params)

                if sources_response.status_code == 200:
                    sources = sources_response.json()
                    us_sources = [
                        source
                        for source in sources
                        if source.get("region", "").upper() == "US"
                    ]
                    return sorted(us_sources, key=lambda x: x["name"])
                else:  # If there are any errors an empty array will be returned
                    print(
                        f"Watchmode source API Error: {sources_response.status_code} - {sources_response.text}"
                    )
                    cache.delete_memoized(watchmode_search, tmdb_id, type)
                    return []
            else:
                cache.delete_memoized(watchmode_search, tmdb_id, type)
                return []
        else:
            print(f"WatchMode API Error: {response.status_code} - {response.text}")
            cache.delete_memoized(watchmode_search, tmdb_id, type)
            return []


def make_cache_key():  # Recommendations' POST method means url isn't unique. I had to make a unique key to cache recs
    data = request.get_json()
    # Create a string representation of the important parts of the request
    key_data = f"{data.get('id')}-{data.get('type')}-{data.get('genre_ids')}-{data.get('keyword_ids')}"
    return key_data


@cache.memoize(3600)
def calculate_similarity(overview1, overview2):
    # Turns text into numerical vector representations
    embedding1 = model.encode(overview1, convert_to_tensor=True, batch_size=16)
    embedding2 = model.encode(overview2, convert_to_tensor=True, batch_size=16)

    # Performs calculation to find how similiar text segments are. 1 = identical and close to 0 means different
    return torch.dot(embedding1, embedding2).item()


def calculate_relevance(
    item, query
):  # Makes sure that items with the query in the name get precidence

    if (
        item.get("popularity") < 3 and item.get("vote_count") < 20
    ):  # If the its not popular and doesn't have a lot of votes put on the bottom
        return 0

    title = item.get("title", "") or item.get("name", "")
    base_score = item.get("popularity", 0)

    # Split query into words for partial matching
    query_words = query.lower().split()

    # Calculates title match score
    title_match_score = 0

    # Exact matches gets highest priority
    if title.lower() == query.lower():
        title_match_score = 10

    # Partial matches where query is contained in title
    elif query.lower() in title.lower():
        title_match_score = 5
    # Check for individual word matches
    else:
        word_matches = sum(1 for word in query_words if word in title.lower())
        if word_matches > 0:
            title_match_score = 2 * word_matches

    # Calculate final score with title matches having higher weight than popularity
    final_score = (title_match_score * 100) + base_score

    return final_score


@cache.memoize(3600)
def expand_pool_with_discover(
    media_genres, media_keywords, media_producers, media_cast, media_type
):
    discover = tmdb.Discover()
    params = {
        "page": 1,
        "original_language": "en",
    }
    if media_genres:
        params["with_genres"] = "|".join(map(str, media_genres))
    if media_keywords:
        params["with_keywords"] = "|".join(map(str, media_keywords))
    if media_cast:
        if media_type == "movie":
            params["with_cast"] = "|".join(map(str, media_cast))
        elif media_type == "tv":
            params["with_people"] = "|".join(map(str, media_cast))
    if media_producers:
        params["with_companies"] = "|".join(map(str, media_producers))

    discover_results = []
    seen_ids = set()
    try:
        for page in range(1, 4):
            params["page"] = page
            results = (
                discover.movie(**params)
                if media_type == "movie"
                else discover.tv(**params)
            )
            for r in results.get("results"):
                r["media_type"] = media_type
                unique_key = f"{r['id']}-{media_type}"
                if unique_key not in seen_ids:  # Deduplication check
                    seen_ids.add(unique_key)
                    discover_results.append(r)
        print(f"Added {len(discover_results)} Discover result")
        return discover_results
    except Exception as e:
        print(f"Error using Discover endpoint: {str(e)}")
        return []


# Jaccard Similarity = |Intersection| / |Union|
# Intersection is the elements that appear in both
# Union is all the elements
def jaccardSim(item1, item2):
    common = set(item1).intersection(set(item2))
    sim = len(common) / len(set(item1).union(set(item2)))

    return sim


def update_user_interests(user_ref, genres, keywords, action):
    if user_ref:
        # Points to interest subcollection
        interests_collection = user_ref.collection("interests")
        # Points to genres and keywords documents
        genres_doc_ref = interests_collection.document("genres")
        keywords_doc_ref = interests_collection.document("keywords")

        # Get current gernes and keywords
        genres_doc = genres_doc_ref.get()
        keywords_doc = keywords_doc_ref.get()

        current_genres = (
            genres_doc.to_dict().get("items", []) if genres_doc.exists else []
        )
        current_keywords = (
            keywords_doc.to_dict().get("items", []) if keywords_doc.exists else []
        )

        if action == "add":
            updated_genres = current_genres.copy()
            for genre in genres:
                genre_id = genre.get("id")
                if not any(g.get("id") == genre_id for g in updated_genres):
                    updated_genres.append(genre)

            updated_keywords = current_keywords.copy()
            for keyword in keywords:
                keyword_id = keyword.get("id")
                if not any(k.get("id") == keyword_id for k in updated_keywords):
                    updated_keywords.append(keyword)

            genres_doc_ref.set(
                {"items": updated_genres, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
            keywords_doc_ref.set(
                {"items": updated_keywords, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )

        elif action == "remove":
            liked_media = list(user_ref.collection("liked_media").stream())
            all_liked_genres = set()
            all_liked_keywords = set()

            for media in liked_media:
                media_data = media.to_dict()
                for genre in media_data.get("genres", []):
                    all_liked_genres.add(genre.get("id"))
                for keyword in media_data.get("keywords", []):
                    all_liked_keywords.add(keyword.get("id"))

            # Media Key is deleted so it loops looking at the genres in current liked_media and removes unliked
            updated_genres = [
                g for g in current_genres if g.get("id") in all_liked_genres
            ]
            updated_keywords = [
                k for k in current_keywords if k.get("id") in all_liked_keywords
            ]

            genres_doc_ref.set(
                {"items": updated_genres, "lastUpdated": firestore.SERVER_TIMESTAMP}
            )
            keywords_doc_ref.set(
                {"items": updated_keywords, "lastUpdated": firestore.SERVER_TIMESTAMP}
            )


def add_to_watchlist(user_id, watchlist_name, media_info):
    user = users_ref.document(user_id).get()
    user_ref = users_ref.document(user_id)

    if not user.exists:
        print(f"User with ID {user_id} does not exist.")
        return None

    watchlist_ref = user_ref.collection("watchlists")
    watchlist_query = watchlist_ref.where("name", "==", watchlist_name).limit(1)
    watchlist_docs = list(watchlist_query.stream())

    if watchlist_docs:
        # If watchlist exists place in doc
        watchlist_doc = watchlist_docs[0]
        watchlist_doc_ref = watchlist_doc.reference
    else:
        watchlist_doc_ref = watchlist_ref.document()
        watchlist_doc_ref.set(
            {
                "name": watchlist_name,
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )
        print(f"Created new watchlist '{watchlist_name}'")

    # Media added to watchlist media subcollection
    media_ref = watchlist_doc_ref.collection("media").document()

    media_data = {
        "title": media_info.get("media_name"),
        "media_id": media_info.get("id"),
        "overview": media_info.get("overview"),
        "release_date": media_info.get("release_date"),
        "media_type": media_info.get("media_type"),
        "poster_path": media_info.get("poster_path"),
        "added_at": firestore.SERVER_TIMESTAMP,
        "status": "Plan to watch",
    }

    media_ref.set(media_data)

    watchlist_doc_ref.update({"updated_at": firestore.SERVER_TIMESTAMP})

    return {"watchlist_id": watchlist_doc_ref.id, "media_id": media_ref.id}


@app.route("/")  # What happens when someone visits the default path.
def home():
    return redirect("http://localhost:3000")  # Redirects to proper url


@app.route(
    "/search", methods=["GET"]
)  # What happens when someone visits the /search endpoint of this Flask API
@cache.cached(query_string=True)  # initializes cache for view function
def search():
    query = (
        request.args.get("query").lower().strip()
    )  # Gets query variable passed from React
    filter_type = request.args.get(
        "filter_type", "all"
    )  # Gets filter choice passed from React
    print(f"recieved query: {query}")  # Logging for troubleshooting

    if not query:
        return jsonify({"error": "query parameter is requred"}), 400
    elif query == "test":  # Test path for troubleshooting
        return jsonify({"test_results": "Successful Test"})
    else:
        try:
            movie_results = []
            tv_results = []
            if filter_type in ["all", "movie"]:  # Filters results
                movie_search = tmdb.Search()  # Initializes tmdbsimple in variable
                movie_search.movie(
                    query=query
                )  # Searchs tmdb API for movies that have query in there names.
                movie_results = movie_search.results

                for (
                    movie
                ) in (
                    movie_results
                ):  # Iterates through results and completes the incomplete poster path given in respoosne
                    poster_path = movie.get("poster_path")
                    if poster_path:
                        movie["poster_url"] = f"{image_url}{poster_path}"
                    movie["media_type"] = (
                        "movie"  # assigns type key:value pairs to all results
                    )

                movie_results = sorted(
                    movie_results,
                    key=lambda x: calculate_relevance(x, query),
                    reverse=True,
                )  # Sorts all results in order of popularity via popularity key.

            if filter_type in ["all", "tv"]:
                tv_search = tmdb.Search()
                tv_search.tv(query=query)
                tv_results = tv_search.results

                for tv in tv_results:
                    poster_path = tv.get("poster_path")
                    if poster_path:
                        tv["poster_url"] = f"{image_url}{poster_path}"
                    tv["media_type"] = "tv"

                tv_results = sorted(
                    tv_results,
                    key=lambda x: calculate_relevance(x, query),
                    reverse=True,
                )

            return jsonify(
                {"tmdb_movie": movie_results or [], "tmdb_tv": tv_results or []}
            )  # Returns both Movie and TV results or empty array if no results are found.

        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route(
    "/search/details", methods=["GET"]
)  # Search/details enpoint (this handles the extra data given when you click a result)
@cache.cached(query_string=True)
def details():
    item_id = request.args.get("id")
    item_type = request.args.get("type")
    print(f"recieved query: {item_id}")

    if not item_id or not item_type:
        return jsonify({"error": "Both id and type parameters are requred"}), 400

    elif item_type == "movie" or item_type == "tv":
        try:
            if item_type == "movie":
                media = tmdb.Movies(
                    item_id
                )  # Searches using the media id instead of name for a 1to1 result across tmdb and watchmode
                keywords_data = media.keywords()
                watchmode_data = watchmode_search(
                    item_id, item_type
                )  # Passes the tmdb_id and type to watchmode search function
            elif item_type == "tv":
                media = tmdb.TV(item_id)
                keywords_data = media.keywords()
                watchmode_data = watchmode_search(item_id, item_type)

            tmdb_details = media.info()  # Gets detailed information from TMDB
            tmdb_details["media_type"] = item_type
            tmdb_details["keywords"] = keywords_data.get(
                "keywords", []
            ) or keywords_data.get("results", [])
            cast_data = media.credits()  # Get cast information

            return jsonify(
                {
                    "tmdb": tmdb_details or [],
                    "watchmode": watchmode_data or [],
                    "cast": cast_data.get("cast", [])[:12] or [],
                }
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route("/recommendations", methods=["POST"])
@limiter.limit(TMDB_RATE)
@cache.cached(timeout=86400, make_cache_key=make_cache_key)
def get_recommendations():  # Unused data for better recommendations.
    data = request.get_json()
    media_id = data.get("id")
    media_type = data.get("type")
    media_overview = data.get("overview", "No overview available")
    media_tagline = data.get("tagline", "No tagline available")
    media_language = data.get("language", "")
    media_region = data.get("region", "").split(",")
    media_producer_id = data.get("producer_ids", "Unknown").split(",")
    media_cast_id = data.get("cast_ids", "No cast information").split(",")
    media_genre_id = data.get("genre_ids", "").split(",")
    media_genre_id = list(
        map(int, media_genre_id)
    )  # Converts content to int and back to list
    media_keyword_id = data.get("keyword_ids", "").split(",")
    media_keyword_id = list(map(int, media_keyword_id))

    recs = []
    recommendations = []
    unique_recs = []
    filtered_recs = []
    x = set()

    # Get pool of recommendations
    try:
        if media_type == "movie":
            recs = tmdb.Movies(media_id).recommendations()
            for result in recs.get("results"):
                result["media_type"] = media_type
        elif media_type == "tv":
            recs = tmdb.TV(media_id).recommendations()
            for result in recs.get("results"):
                result["media_type"] = media_type
        if isinstance(recs, dict) and "results" in recs:
            recommendations.extend(recs.get("results"))
        else:
            print(f"Unexpected response format: {recs}")  # Log unexpected cases
            recommendations = []
    except Exception as e:
        print(f"Error getting recommendations: {str(e)}")

    media_info = f"{media_overview}.{media_tagline}."

    recommendations.extend(
        expand_pool_with_discover(
            media_genre_id,
            media_keyword_id,
            media_producer_id,
            media_cast_id,
            media_type,
        )
    )

    for rec in recommendations:  # Prevent duplicate recommendations
        unique_key = f"{rec.get('id')}-{rec.get('media_type')}"
        if unique_key not in x and rec.get("id") != int(
            media_id
        ):  # Make sure we dont get the original media in recommendations
            x.add(unique_key)
            unique_recs.append(rec)

    for rec in unique_recs:  # Compare to all query items' overviews
        if rec.get("media_type") == "movie":
            media = tmdb.Movies(rec.get("id"))
        elif rec.get("media_type") == "tv":
            media = tmdb.TV(rec.get("id"))
        else:
            print("Recs: something went wrong")
        info = media.info()
        keywords_data = media.keywords()
        credits = media.credits()

        rec_data = {  # Framework for more data to use if needed. We would have to pass more from frontend to match
            "title": info.get("title") or info.get("name"),
            "overview": info.get("overview"),
            "tagline": info.get("tagline"),
            "release_date": info.get("release_date") or info.get("first_air_date"),
            "production_companies": info.get("production_companies", []),
            "networks": info.get("networks", []),
            "keywords": keywords_data.get("keywords", []),
            "genres": info.get("genres", []),
            "cast": credits.get("cast", [])[:5],
            "popularity": info.get("popularity", []),
            "origin_country": info.get("origin_country", []),
            "origin_language": info.get("origin_language", []),
        }

        rec_genres = list(map(int, [rec["id"] for rec in rec_data.get("genres")]))

        rec_info = f"{rec_data.get('overview', '')}.{rec_data.get('tagline', '')}."

        rec_release_date = rec_data.get("release_date") or "2000-01-01"

        try:
            if rec_release_date:
                release_date = datetime.datetime.strptime(
                    rec_release_date, "%Y-%m-%d"
                ).date()
                current_date = datetime.datetime.now().date()
                age_in_years = (current_date - release_date).days / 365.0
                recency_score = max(0, 1 - (age_in_years / 10))
            else:
                recency_score = 0.5
        except (ValueError, TypeError):
            recency_score = 0.5

        # Region Check
        countries = rec_data.get("origin_country")
        if (
            isinstance(countries, list) and countries
        ):  # Ensure it's a list and not empty
            countries = {c for c in countries}
            country_check = False
            for c in countries:  # Check recommendation countries against r
                for r in media_region:
                    if c == r:
                        country_check = True
        else:
            country_check = False

        if rec_data.get("original_language") != media_language and country_check:
            continue

        # Genre similarity check
        if not media_genre_id or not rec_genres:
            genre_sim = 0.1
        else:
            genre_sim = jaccardSim(media_genre_id, rec_genres)
            if genre_sim:
                genre_sim = max(genre_sim, 0.2)

        text_sim = calculate_similarity(media_info, rec_info)  # Text similarity check

        rec_keywords = list(
            map(int, [rec["id"] for rec in rec_data.get("keywords", [])])
        )
        if media_keyword_id and rec_keywords:  # Keyword similarity check
            keyword_sim = jaccardSim(media_keyword_id, rec_keywords)
        else:
            keyword_sim = 0

        total_score = (
            (genre_sim * 0.3)  # Genre importance: 30%
            + (text_sim * 0.35)  # Text similarity importance: 35%
            + (keyword_sim * 0.2)  # Keyword importance: 20%
            + (rec_data.get("popularity", 0) * 0.1)  # Popularity importance: 10%
            + (recency_score * 0.05)  # Recency importance 5%
        )

        filtered_recs.append(  # Recommendations are given weight based on importance
            {"rec": rec, "score": total_score}
        )

    filtered_recs = sorted(filtered_recs, key=lambda x: -x["score"])
    results = [item["rec"] for item in filtered_recs[:16]]
    if results:
        return jsonify({"recommendations": results or []})
    else:
        return jsonify(
            {"recommendations": tmdb.Movies().popular()["results"][:8] or []}
        )


@app.route("/cache_stats")
def cache_stats():
    return jsonify(
        {
            "size": cache.cache._cache.__len__(),
        }
    )


@app.route("/user-dashboard", methods=["GET", "POST"])  # User dashboard data
@cache.cached(query_string=True)
def user_dashboard():
    if request.method == "POST":
        media_info = request.get_json()
    else:
        user_id = request.args.get("id")
        watch_list_name = request.args.get("watch_list_name")

    specific_user = users_ref.document("h2GwHXadtj0FFUuPmWBT").get()
    if specific_user.exists:
        print(f"User data: {specific_user.to_dict()}")
    # Pull user information to pass to firebase
    # Pull media information under user.
    # Return Media to be formatted by react.

    print("In Progress")


@app.route("/interactions/media_liked", methods=["POST"])
def handle_media_like():
    data = request.get_json()
    user_id = data.get("user_id")
    media_id = data.get("media_id")
    media_type = data.get("media_type")
    title = data.get("title")
    genres = data.get("genres", [])
    keywords = data.get("keywords", [])
    action = data.get("action", "like")  # Track like or unlike

    if not user_id or not media_id:
        return jsonify({"error": "User ID and Media ID are required"})

    user_ref = users_ref.document(user_id)  # Points to the specific user document
    user_doc = user_ref.get()

    if not user_doc.exists:
        return jsonify({"error": "User not found"})

    liked_media_ref = user_ref.collection("liked_media")
    media_key = f"{media_type}_{media_id}"

    # Liking media add genres and keywords for recommendations later
    if action == "like":  # Add movie/Show to liked_media collection under specfic user
        liked_media_ref.document(media_key).set(
            {  # media key acts as the unique id since i am defining it manually.
                "media_id": media_id,
                "media_type": media_type,
                "title": title,
                "genres": genres,
                "keywords": keywords,
                "timestamp": firestore.SERVER_TIMESTAMP,
            }
        )

        update_user_interests(user_ref, genres, keywords, "add")
        return jsonify({"status": "success", "message": "Media liked successfully"})

    elif (
        action == "unlike"
    ):  # In the event of an unlike, media is removed along with keywords and genres of media
        media_doc = liked_media_ref.document(media_key).get()
        if not media_doc.exists:
            return jsonify({"error": "Media was never liked"})

        media_data = media_doc.to_dict()
        removed_genres = media_data.get("genres", [])
        removed_keywords = media_data.get("keywords", [])

        liked_media_ref.document(media_key).delete()

        update_user_interests(user_ref, removed_genres, removed_keywords, "remove")
        return jsonify({"status": "success", "message": "Media unliked successfully"})

    else:
        return jsonify({"error": "Invalid action"})


@app.route("/interactions/check_liked", methods=["GET"])
def check_if_media_liked():
    user_id = request.args.get("user_id")
    media_id = request.args.get("media_id")
    media_type = request.args.get("media_type")

    if not user_id or not media_id or not media_type:
        return jsonify({"error": "User ID, Media ID, and Media Type are required"})

    user_ref = users_ref.document(user_id)
    if not user_ref.get().exists:
        return jsonify({"error": "User not found"})

    media_key = f"{media_type}_{media_id}"
    liked_media_doc = user_ref.collection("liked_media").document(media_key).get()

    return jsonify({"liked": liked_media_doc.exists})


@app.route("/interactions/add-watchlist", methods=["POST"])
def add_media_to_watchlist():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_name = data.get("watchlist_name")
    media_info = data.get("media_info")

    if not user_id or not watchlist_name or not media_info:
        return jsonify({"error": "Missing required parameters"})

    result = add_to_watchlist(user_id, watchlist_name, media_info)
    if result:
        return jsonify(
            {
                "status": "success",
                "message": f"Added to watchlist '{watchlist_name}'",
                "watchlist_id": result,
            }
        )
    else:
        return (jsonify({"error": "Failed to add to watchlist"}),)


@app.route("/interactions/get-watchlists", methods=["GET"])
def get_user_watchlists():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "User login required"})

    user_ref = users_ref.document(user_id)
    if not user_ref.get().exists:
        return jsonify({"error": "User not found"})

    watchlists = []

    watchlist_docs = user_ref.collection("watchlists").stream()

    for doc in watchlist_docs:
        watchlist_data = doc.to_dict()
        watchlists.append(
            {
                "id": doc.id,  # Actual document id
                "name": watchlist_data.get("name"),
                "created_at": watchlist_data.get("created_at"),
                "updated_at": watchlist_data.get("updated_at"),
            }
        )

    return jsonify({"watchlists": watchlists})


@app.route(
    "/interactions/get-watchlist-media", methods=["GET"]
)  # For getting all watchlist media
def get_watchlist_media():
    user_id = request.args.get("user_id")
    watchlist_id = request.args.get("watchlist_id")

    if not user_id or not watchlist_id:
        return jsonify({"error": "User ID and Watchlist ID are required"})

    user_ref = users_ref.document(user_id)
    if not user_ref.get().exists:
        return jsonify({"error": "User not found"})

    watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
    if not watchlist_ref.get().exists:
        return jsonify({"error": "Watchlist not found"})

    media_items = []
    media_docs = watchlist_ref.collection("media").stream()

    for doc in media_docs:  # Each doc is a movie or tv show within a watchlist
        media_data = doc.to_dict()
        media_items.append(
            {
                "id": doc.id,
                "media_id": media_data.get("media_id"),
                "media_type": media_data.get("media_type"),
                "title": media_data.get("title"),
                "overview": media_data.get("overview"),
                "release_date": media_data.get("release_date"),
                "poster_path": media_data.get("poster_path"),
                "added_at": media_data.get("added_at"),
                "status": media_data.get("status", "Plan to watch"),
            }
        )

    return jsonify({"media": media_items})


@app.route("/interactions/remove-from-watchlist", methods=["POST"])
def remove_from_watchlist():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_id = data.get("watchlist_id")
    media_id = data.get("media_id")

    if not user_id or not watchlist_id or not media_id:
        return jsonify({"error": "Requirements not meet for operation"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
        if not watchlist_ref.get().exists:
            return jsonify({"error": "Watchlist not found"})

        media_query = watchlist_ref.collection("media").where(
            "media_id", "==", media_id
        )
        media_docs = media_query.get()

        if len(list(media_docs)) == 0:
            return jsonify({"error": "Media not found in watchlist"})

        for doc in media_docs:
            doc.reference.delete()

        watchlist_ref.update({"updated_at": firestore.SERVER_TIMESTAMP})

        return jsonify({"status": "success", "message": "Media removed from watchlist"})
    except Exception as e:
        print(f"Error removing media from watchlist: {str(e)}")
        return jsonify({"error": f"Failed to remove media from watchlist: {str(e)}"})


@app.route("/interactions/delete-watchlist", methods=["POST"])
def delete_watchlist():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_id = data.get("watchlist_id")

    if not user_id or not watchlist_id:
        return jsonify({"error": "Requirements not meet for operation"})
    try:  # Going down the line deleting
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})
        watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
        if not watchlist_ref.get().exists:
            return jsonify({"error": "Watchlist not found"})
        # Start deleting the media subcollection
        media_docs = watchlist_ref.collection("media").stream()
        for doc in media_docs:
            doc.reference.delete()
        # Then I delete the watchlist
        watchlist_ref.delete()
        return jsonify(
            {"status": "success", "message": "Watchlist deleted successfully"}
        )
    except Exception as e:
        print(f"Error deleting watchlist: {str(e)}")
        return jsonify({"error": f"Failed to delete watchlist: {str(e)}"})


@app.route("/interactions/update-media-status", methods=["POST"])
def update_media_status():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_id = data.get("watchlist_id")
    media_id = data.get("media_id")
    status = data.get("status")

    if not user_id or not watchlist_id or not media_id or status is None:
        return jsonify({"error": "Requirements not meet for operation"})
    media_id = int(media_id)

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
        if not watchlist_ref.get().exists:
            return jsonify({"error": "watchlist not found"})

        media_query = watchlist_ref.collection("media").where(
            "media_id", "==", media_id
        )
        media_docs = media_query.get()

        # Check if the media is in the media subcollection
        if len(list(media_docs)) == 0:
            return jsonify({"error": "Media not found in watchlist"})

        for doc in media_docs:
            doc.reference.update({"status": status})

        watchlist_ref.update({"updated_at": firestore.SERVER_TIMESTAMP})

        return jsonify(
            {"status": "success", "message": "Media status updated successfully"}
        )

    except Exception as e:
        print(f"Error updating media status: {str(e)}")
        return jsonify({"error": f"Failed to update media status: {str(e)}"})


@app.route("/interactions/initialize-ratings", methods=["POST"])
def initialize_ratings():
    data = request.get_json()
    user_id = data.get("user_id")
    media_id = data.get("media_id")
    media_type = data.get("media_type")

    if not user_id or not media_id or not media_type:
        return jsonify({"error": "User ID, Media ID, and Media Type are required"})

    try:
        # Checks if a rating already exists
        ratings_ref = db.collection("Ratings")
        query_ref = (
            ratings_ref.where("user_id", "==", user_id)
            .where("media_id", "==", media_id)
            .where("media_type", "==", media_type)
        )

        existing_ratings = list(query_ref.get())

        # If no rating exists, create a default one with 0 value
        if not existing_ratings:
            default_rating = {
                "rating": 0,
                "averageRating": 0,
                "user_id": user_id,
                "media_id": media_id,
                "media_type": media_type,
                "created_at": firestore.SERVER_TIMESTAMP,
            }

            doc_ref, _ = ratings_ref.add(
                default_rating
            )  # Add returns a documentreference and a WriteTime object
            # doc_ref takes the doc_ref and _ is used to throwaway the rest

            return jsonify(
                {
                    "status": "success",
                    "message": "Default rating initialized",
                    "rating_id": doc_ref.id,
                    "rating": 0,
                }
            )

        # If a rating already exists, return it
        rating_doc = existing_ratings[0]
        rating_data = rating_doc.to_dict()

        return jsonify(
            {
                "status": "success",
                "message": "Rating found",
                "rating_id": rating_doc.id,
                "rating": rating_data.get("rating", 0),
            }
        )

    except Exception as e:
        print(f"Error initializing rating: {str(e)}")
        return jsonify({"error": f"Failed to initialize rating: {str(e)}"})


if __name__ == "__main__":
    app.run(port=5000, debug=True)  # Starts the Flask app and sets the port.
