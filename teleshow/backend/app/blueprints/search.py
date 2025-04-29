# Written By Moses Pierre
from flask import Blueprint, request, jsonify
import requests
import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from app.extensions import cache, limiter
import datetime
import os  # Used to find file paths
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# Simple rate limiter that keeps count of the function calls and thus api calls.
from ratelimit import limits, sleep_and_retry


search_bp = Blueprint("search", __name__)

base_url = "https://api.watchmode.com/v1"  # Base API urls used to create full urls for API calls.


# For debugging. Prints to console when ratelimit is reached
def on_rate_limit_breach(request_limit):
    print(f"Rate limit exceeded: {request_limit}")


# Saves the watchmode API to a variable
api_key = os.getenv("PY_WATCHMODE_API_KEY")


def make_search_cache_key():
    query = request.args.get("query", "").lower().strip()
    filter_type = request.args.get("filter_type", "all")
    streaming_platform = request.args.get("streaming_platform", "all")
    key_data = f"search-{filter_type}-{streaming_platform}-{query}"

    return key_data


# TMDB STREAMING PLATFORM MAP
PLATFORM_ID_MAP = {
    "netflix": [8, 1796, 175],
    "hulu": [15],
    "disney": [337, 122, 2336],
    "amazon": [9, 10, 119, 2100],
    "max": [1899, 387],
    "paramount": [531, 2303, 2304, 1853],
    "microsoft store": [68],
    "apple": [2],
    "google": [3, 192],
    "peacock": [389],
}


# Function that gets the watchproviders for media using id and type
# I ran into a problem here where tmdbsimple wrapper was giving None responses
# The wrapper is supposed to give an error message or something. None means that something is wrong with the wrapper
# To combat this im using a call directly to the api if None is given as a response
# Executed by the thread
@sleep_and_retry
@limits(calls=50, period=5)
@cache.memoize(3600)
def get_watch_providers(media_id, media_type):
    try:
        # Direct API call, tmdbsimple limitation
        # I was getting None responses
        print(f"Attempting direct API call")
        api_key = tmdb.API_KEY
        url = f"https://api.themoviedb.org/3/{media_type}/{media_id}/watch/providers?api_key={api_key}"
        response = requests.get(url)
        if response.status_code == 200:
            providers = response.json()
            print(f"Direct API response successful")
        else:
            print(f"Direct API call failed: {response.status_code}")
            return []

        if providers is None:
            print(f"No provider data available for {media_type} ID {media_id}")
            return []

        # Extract US providers
        provider_data = providers.get("results", {})
        us_providers = provider_data.get("US", {})

        if not us_providers:
            return []

        # For deduplication
        provider_ids = set()
        for provider_type in ["flatrate", "buy", "rent"]:
            for provider in us_providers.get(provider_type, []):
                provider_id = provider.get("provider_id")
                if provider_id:
                    provider_ids.add(provider_id)

        return list(provider_ids)

        # Returns the numeric id for watch providers
    except Exception as e:
        print(f"Error fetching providers: {e}")
        return []


# Serperate thread executed function to handle movie search
def process_movies(query, streaming_platform, movie_results, movies_done):
    try:
        movie_search = tmdb.Search()
        movie_search.movie(query=query)

        all_movies = []
        for item in movie_search.results:
            item["media_type"] = "movie"
            all_movies.append(item)

        if streaming_platform != "all":
            platform_list = (
                streaming_platform.split(",")
                if streaming_platform != "all"
                else ["all"]
            )
            all_platform_ids = set()
            for platform in platform_list:
                platform_ids = PLATFORM_ID_MAP.get(platform.lower(), [])
                all_platform_ids.update(platform_ids)

            with ThreadPoolExecutor(max_workers=5) as executor:
                # Using threadpoolexecutor, the return are futures that can be worked with
                # This is created a pool of threads to perform the defined function with the args
                # Just a reminder for myself that enumerate returns a tuple of iterator and value
                # This syntax creates a dictionary in python
                # The key here is the future objects and the values are the indices of each movie in the list
                # Future objects are held as memory addresses so they're unique
                # In short future:(movie_index:movie_value)
                future_to_movie = {
                    executor.submit(get_watch_providers, movie["id"], "movie"): i
                    for i, movie in enumerate(all_movies)
                }
                # as_completed gets the futures as they complete
                for future in as_completed(future_to_movie):
                    # This works because I set the future object as a key in the line above
                    # It returns the index of the movie in all_movies
                    i = future_to_movie[future]
                    try:
                        provider_ids = future.result(timeout=5)
                        if any(pid in all_platform_ids for pid in provider_ids):
                            movie_results.append(all_movies[i])
                    except Exception as e:
                        print(f"Fetching Provider failed: {e}")
        else:
            movie_results.extend(all_movies)
    except Exception as e:
        print(f"Error in movie processing thread: {e}")
    finally:
        # Signals the the movies are done
        movies_done.set()


# Serperate thread executed function to handle tv search
def process_tv_shows(query, streaming_platform, tv_results, tv_done):
    try:
        tv_search = tmdb.Search()
        tv_search.tv(query=query)
        all_tv = []
        for item in tv_search.results:
            item["media_type"] = "tv"
            all_tv.append(item)

        if streaming_platform != "all":
            platform_list = (
                streaming_platform.split(",")
                if streaming_platform != "all"
                else ["all"]
            )
            all_platform_ids = set()
            for platform in platform_list:
                platform_ids = PLATFORM_ID_MAP.get(platform.lower(), [])
                all_platform_ids.update(platform_ids)

            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_tv = {
                    executor.submit(get_watch_providers, tv["id"], "tv"): i
                    for i, tv in enumerate(all_tv)
                }
                # as_completed gets the futures as they complete
                for future in as_completed(future_to_tv):
                    # This works because I set the future object as a key in the line above
                    # It returns the index of the movie in all_movies
                    i = future_to_tv[future]
                    try:
                        provider_ids = future.result(timeout=5)
                        if any(pid in all_platform_ids for pid in provider_ids):
                            tv_results.append(all_tv[i])
                    except Exception as e:
                        print(f"Fetching Provider failed: {e}")
        else:
            tv_results.extend(all_tv)
    except Exception as e:
        print(f"Error in tv processing thread: {e}")
    finally:
        # Signals the the tv shows are done
        tv_done.set()


# FUNCTION FOR CALCULATING RELEVANCE FOR SEARCH RESULT SORTING
def calculate_relevance(item, query):
    title = item.get("title", "") or item.get("name", "")

    if not title:
        return 0

    if (
        item.get("popularity") < 3 and item.get("vote_count") < 20
    ):  # If its been released and its not popular and doesn't have a lot of votes put on the bottom
        return 0
    # Makes sure that items with the query in the name get precidence
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

    # Consider release date for recency
    release_date_score = 0
    release_date = item.get("release_date") or item.get("first_air_date")
    if release_date:
        try:
            year = int(release_date[:4])
            current_year = datetime.datetime.now().year
            years_old = current_year - year
            release_date_score = max(
                0, 1 - (years_old / 10)
            )  # Newer content scores higher
        except:
            pass

    # Vote average
    vote_avg_score = item.get("vote_average", 0) / 10

    # Calculate final score with title matches having higher weight than popularity
    final_score = (
        (title_match_score * 100)  # Title match has highest weight
        + (release_date_score * 20)  # Recency has medium weight
        + (vote_avg_score * 15)  # Rating quality has medium weight
        + (base_score * 10)  # Popularity has lower weight
    )

    return final_score


# What happens when someone visits the /search endpoint of this Flask API
@search_bp.route("/", methods=["GET"])
# Initializes cache for view function
@limiter.limit("50 per 5 seconds")
@cache.cached(query_string=True, make_cache_key=make_search_cache_key)
def search():
    # Gets query variable passed from React
    query = request.args.get("query").lower().strip()
    # Gets filter choice passed from React
    filter_type = request.args.get("filter_type", "all")
    # Filter by streaming platform
    streaming_platform = request.args.get("streaming_platform", "all")
    print(f"recieved query: {query}")  # Logging for troubleshooting

    if not query:
        return jsonify({"error": "query parameter is requred"}), 400
    elif query == "test":  # Test path for troubleshooting
        return jsonify({"test_results": "Successful Test"})
    else:
        try:
            movie_results = []
            tv_results = []
            # Thread event flags
            movies_done = threading.Event()
            tv_done = threading.Event()
            # Starts the threads based on the filter
            if filter_type == "all" or filter_type == "movie":
                movie_thread = threading.Thread(
                    target=process_movies,
                    args=(query, streaming_platform, movie_results, movies_done),
                )
                movie_thread.daemon = True
                movie_thread.start()
            else:
                movies_done.set()

            if filter_type == "all" or filter_type == "tv":
                tv_thread = threading.Thread(
                    target=process_tv_shows,
                    args=(query, streaming_platform, tv_results, tv_done),
                )
                tv_thread.daemon = True
                tv_thread.start()
            else:
                tv_done.set()

            movies_done.wait(timeout=15)
            tv_done.wait(timeout=15)
            # Gather the results and return to frontend
            if filter_type == "all":
                all_results = []

                for item in movie_results:
                    relavance = calculate_relevance(item, query)
                    all_results.append({"item": item, "relevance": relavance})

                for item in tv_results:
                    relavance = calculate_relevance(item, query)
                    all_results.append({"item": item, "relevance": relavance})

                all_results = sorted(
                    all_results, key=lambda x: x["relevance"], reverse=True
                )

                final_results = [result["item"] for result in all_results]

                return jsonify({"results": final_results or []})
            elif filter_type == "movie":
                movie_results = sorted(
                    movie_results,
                    key=lambda x: calculate_relevance(x, query),
                    reverse=True,
                )  # Sorts all results in order of popularity via popularity key.

                return jsonify({"tmdb_movie": movie_results or []})
            elif filter_type == "tv":
                tv_results = tv_results = sorted(
                    tv_results,
                    key=lambda x: calculate_relevance(x, query),
                    reverse=True,
                )
                return jsonify({"tmdb_tv": tv_results or []})

        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Search/details enpoint (this handles the extra data given when you click a result)
@search_bp.route("/details", methods=["GET"])
@limiter.limit("50 per 5 seconds")
@cache.cached(query_string=True)
def details():
    item_id = request.args.get("id")
    item_type = request.args.get("type")
    print(f"recieved query: {item_id}")

    if not item_id or not item_type:
        return jsonify({"error": "Both id and type parameters are requred"}), 400

    elif item_type == "movie" or item_type == "tv":
        try:
            media = tmdb.Movies(item_id) if item_type == "movie" else tmdb.TV(item_id)
            get_ratings = "release_dates" if item_type == "movie" else "content_ratings"
            tmdb_details = media.info(
                append_to_response=f"keywords,credits,videos,images,{get_ratings}"
            )  # Gets detailed information from TMDB using append_to_response. Saves on quota

            tmdb_details["media_type"] = (
                item_type  # Saves item type to item since info() doesn't give it
            )
            # Response for movie and show keywords is different
            if "keywords" in tmdb_details:
                key = "keywords" if item_type == "movie" else "results"
                tmdb_details["keywords"] = tmdb_details["keywords"].get(key, [])

            if item_type == "tv":
                content_ratings = tmdb_details.get("content_ratings", {})
                results = content_ratings.get("results", [])
                for item in results:
                    if item.get("iso_3166_1") == "US":
                        tmdb_details["content_rating"] = item.get("rating")
                        break
            elif item_type == "movie":
                release_dates = tmdb_details.get("release_dates", {})
                results = release_dates.get("results", [])
                for item in results:
                    if item.get("iso_3166_1") == "US":
                        release_dates_list = item.get("release_dates", [])
                        if release_dates_list and len(release_dates_list) > 0:
                            tmdb_details["content_rating"] = release_dates_list[0].get(
                                "certification", ""
                            )
                            break

            watchmode_data = watchmode_search(
                item_id, item_type
            )  # Passes the tmdb_id and type to watchmode search function"

            return jsonify(
                {
                    "tmdb": tmdb_details or [],
                    "watchmode": watchmode_data or [],
                }
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# GET SEASON INFORMATION FOR TV SHOWS
@search_bp.route("/tv/all_episodes", methods=["GET"])
@limiter.limit("50 per 5 seconds")
@cache.cached(query_string=True)
def get_all_tv_episodes():
    tv_id = request.args.get("id")

    if not tv_id:
        return jsonify({"error": "TV Show ID is required"})

    try:
        # Getting the seasons for the tv show
        tv = tmdb.TV(tv_id)
        tv_info = tv.info()
        seasons_data = tv_info.get("seasons", [])

        if len(seasons_data) > 0:
            seasons_data = [s for s in seasons_data if s.get("season_number") != 0]

        # Getting the episodes for the season
        episodes_by_season = {}
        for season in seasons_data:
            season_number = season.get("season_number")
            tv_seasons = tmdb.TV_Seasons(tv_id, season_number)
            season_info = tv_seasons.info()
            episodes_by_season[season_number] = season_info.get("episodes", [])
        return jsonify({"seasons": seasons_data, "episodes": episodes_by_season})
    except Exception as e:
        return jsonify({"error": str(e)})


@cache.memoize(3600)  # Initializes cache for function
@limiter.limit("100 per minute", on_breach=on_rate_limit_breach)
def watchmode_search(tmdb_id, type):  # Function takes tmdb id and type (movie or tv)
    url = f"{base_url}/search/"  # Endpoint url building
    search_field = "tmdb_movie_id" if type == "movie" else "tmdb_tv_id"
    params = {
        "apiKey": api_key,
        "search_field": search_field,  # If type is 'movie', search field is set to the tmdb_movie_id endpoint
        "search_value": tmdb_id,
    }  # The value being passed

    response = requests.get(url, params=params)  # Request made to API endpoint

    if response.status_code == 200:  # Watchmode code 200 means request was successful
        results = response.json().get("title_results", [])

        # Iterates through the results given and gets data under ID key from results
        if results and isinstance(results, list):
            title_id = results[0].get("id")
            sources_url = f"{base_url}/title/{title_id}/sources/"  # ID key used to query the sources endpoint
            sources_params = {"apiKey": api_key}
            sources_response = requests.get(sources_url, params=sources_params)

            if sources_response.status_code == 200:
                sources = sources_response.json()
                us_sources = [
                    source
                    for source in sources
                    if source.get("region", "").upper() == "US"
                ]
                unique_sources = []
                seen = set()

                for s in us_sources:
                    key = (s.get("name"), s.get("type"), s.get("price"))
                    if key not in seen:
                        seen.add(key)
                        unique_sources.append(s)
                return sorted(
                    unique_sources, key=lambda x: x["name"]
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
