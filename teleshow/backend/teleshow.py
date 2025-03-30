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
import os  # Used to find file paths
import datetime
import torch  # Enabler of machine learning. Allows for the dot
import torch.nn.functional as F
import firebase_admin  # Firebase imports that allow connection to firestore for user data
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

# Initializes the Flask limiter. Helps avoid the rate limiters for TMDB and Wathmode
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
firebase_key = os.path.join(
    script_dir, "Resources", "teleshow-firebase.json"
)  # Gets the firebase keyfile

cred = credentials.Certificate(firebase_key)  # Firebase initialization
firebase_admin.initialize_app(cred)
db = firestore.client()
users_ref = db.collection(
    "users-test"
)  # Points the default collection to users collection


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


def make_cache_key():  # Recommendations' POST method means url isn't unique. I had to make a unique key to cache recs.
    data = request.get_json()
    # Create a string representation of the important parts of the request using f-string
    key_data = f"{data.get('id')}-{data.get('type')}-{data.get('genre_ids')}-{data.get('keyword_ids')}"
    return key_data


# COMPARES TWO OVERVIEWS AND TAGLINES
@cache.memoize(3600)
def calculate_similarity(overview1, overview2):
    # Turns text into numerical vector representations
    embedding1 = model.encode(overview1, convert_to_tensor=True, batch_size=16)
    embedding2 = model.encode(overview2, convert_to_tensor=True, batch_size=16)

    # Performs consine calculation to find how similiar text segments are. 1 = identical and close to 0 means different
    return F.cosine_similarity(embedding1.unsqueeze(0), embedding2.unsqueeze(0)).item()


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


# FUNCTION FOR EXPANDING POOL FOR RECOMMENDATIONS
@cache.memoize(3600)
def expand_pool_with_discover(
    media_genres, media_keywords, media_producers, media_type
):
    discover = tmdb.Discover()
    params = {
        "page": 1,
        "original_language": "en",
    }
    # Sends the properties of the media through discover endpoint
    if media_genres:
        params["with_genres"] = "|".join(map(str, media_genres))
    if media_producers:
        params["with_companies"] = "|".join(map(str, media_producers))

    discover_results = []
    seen_ids = set()
    try:
        # Start initial search with genres and producers
        initial_results = []
        for page in range(1, 3):
            params["page"] = page
            results = (
                discover.movie(**params)
                if media_type == "movie"
                else discover.tv(**params)
            )
            initial_results.extend(results.get("results", []))

            # If there are too many results, slim them down by adding the keywords check
            if len(initial_results) > 100 and media_keywords:
                params["with_keywords"] = "|".join(map(str, media_keywords))

            for page in range(1, 5):
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


# FUNCTION FOR UPDATING USER INTERESTS IN FIRESTORE
def update_user_interests(user_ref, genres, keywords, production_companies, action):
    if user_ref:
        # Points to interest subcollection of users
        interests_collection = user_ref.collection("interests")
        # Points to genres and keywords documents
        genres_doc_ref = interests_collection.document("genres")
        keywords_doc_ref = interests_collection.document("keywords")
        companies_doc_ref = interests_collection.document("production_companies")

        # Get current gernes and keywords
        genres_doc = genres_doc_ref.get()
        keywords_doc = keywords_doc_ref.get()
        companies_doc = companies_doc_ref.get()

        current_genres = (
            genres_doc.to_dict().get("items", []) if genres_doc.exists else []
        )
        current_keywords = (
            keywords_doc.to_dict().get("items", []) if keywords_doc.exists else []
        )
        current_companies = (
            companies_doc.to_dict().get("items", []) if companies_doc.exists else []
        )
        # If the action was add, append the genres and keywords in genres to the temp arrays
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

            updated_companies = current_companies.copy()
            for company in production_companies:
                company_id = company.get("id")
                if not any(k.get("id") == company_id for k in updated_companies):
                    updated_companies.append(company)

            # Set the new values in the array. Set will ignore the values that were already there and add the new values
            genres_doc_ref.set(
                {"items": updated_genres, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
            keywords_doc_ref.set(
                {"items": updated_keywords, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
            companies_doc_ref.set(
                {"items": updated_companies, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )

        # If the action was remove
        elif action == "remove":
            # Get the followed media collection
            followed_media = list(user_ref.collection("followed_media").stream())
            all_followed_genres = set()
            all_followed_keywords = set()
            all_followed_companies = set()

            for media in followed_media:
                media_data = media.to_dict()
                for genre in media_data.get("genres", []):
                    all_followed_genres.add(genre.get("id"))
                for keyword in media_data.get("keywords", []):
                    all_followed_keywords.add(keyword.get("id"))
                for company in media_data.get("production_companies", []):
                    all_followed_companies.add(company.get("id"))

            # Media Key is deleted in another view function so it loops looking at the genres in current followed_media and removes unfollowed
            updated_genres = [
                g for g in current_genres if g.get("id") in all_followed_genres
            ]
            updated_keywords = [
                k for k in current_keywords if k.get("id") in all_followed_keywords
            ]
            updated_companies = [
                c for c in current_companies if c.get("id") in all_followed_companies
            ]

            genres_doc_ref.set(
                {"items": updated_genres, "lastUpdated": firestore.SERVER_TIMESTAMP}
            )
            keywords_doc_ref.set(
                {"items": updated_keywords, "lastUpdated": firestore.SERVER_TIMESTAMP}
            )
            companies_doc_ref.set(
                {"items": updated_companies, "lastUpdated": firestore.SERVER_TIMESTAMP}
            )


# FUNCTION FOR ADDING TO WATCHLIST IN FIRESTORE
def add_to_watchlist(user_id, watchlist_name, media_info):
    user = users_ref.document(user_id).get()
    user_ref = users_ref.document(user_id)

    if not user.exists:
        print(f"User with ID {user_id} does not exist.")
        return None

    # Go to the watchlists subcollection of users
    watchlist_ref = user_ref.collection("watchlists")
    # Look for the watchlist document that matches the key
    watchlist_query = watchlist_ref.where("name", "==", watchlist_name).limit(1)
    # Get the results
    watchlist_docs = list(watchlist_query.stream())

    if watchlist_docs:
        # Set the doc to the first result
        # If watchlist exists get reference
        watchlist_doc = watchlist_docs[0]
        watchlist_doc_ref = watchlist_doc.reference
    else:
        # If it doesn't create a new document
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


# What happens when someone visits the default path.
@app.route("/")
def home():
    return redirect("http://localhost:3000")  # Redirects to proper url


@app.route("/trending", methods=["GET"])
@limiter.limit(TMDB_RATE)
@cache.cached(query_string=True, timeout=3600)
def get_trending():
    try:
        movies = tmdb.Movies()
        movie_data = movies.popular(region="USA")

        tv = tmdb.TV()
        tv_data = tv.top_rated()

        return jsonify(
            {
                "movies": movie_data.get("results"),
                "tv": tv_data.get("results"),
            }
        )
    except Exception as e:
        print(f"Error getting trending TV shows: {str(e)}")
        return jsonify({"error": str(e)})


# What happens when someone visits the /search endpoint of this Flask API
@app.route("/search", methods=["GET"])
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
            if filter_type in ["all", "tv"]:
                tv_search = tmdb.Search()
                tv_search.tv(query=query)
                tv_results = tv_search.results

                for tv in tv_results:
                    poster_path = tv.get("poster_path")
                    if poster_path:
                        tv["poster_url"] = f"{image_url}{poster_path}"
                    tv["media_type"] = "tv"
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
            else:
                if filter_type == "movie":
                    movie_results = sorted(
                        movie_results,
                        key=lambda x: calculate_relevance(x, query),
                        reverse=True,
                    )  # Sorts all results in order of popularity via popularity key.

                    return jsonify({"tmdb_movie": movie_results or []})
                else:
                    tv_results = tv_results = sorted(
                        tv_results,
                        key=lambda x: calculate_relevance(x, query),
                        reverse=True,
                    )
                return jsonify({"tmdb_tv": tv_results or []})

        except Exception as e:
            return jsonify({"error": str(e)}), 500


# Search/details enpoint (this handles the extra data given when you click a result)
@app.route("/search/details", methods=["GET"])
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
                """"
                watchmode_data = watchmode_search(
                    item_id, item_type
                )  # Passes the tmdb_id and type to watchmode search function"

                """  # Saving api queries during testing
            elif item_type == "tv":
                media = tmdb.TV(item_id)
                keywords_data = media.keywords()

                # watchmode_data = watchmode_search(item_id, item_type)

            tmdb_details = media.info()  # Gets detailed information from TMDB
            tmdb_details["media_type"] = item_type
            tmdb_details["keywords"] = keywords_data.get(
                "keywords", []
            ) or keywords_data.get("results", [])
            cast_data = media.credits()  # Get cast information

            return jsonify(
                {
                    "tmdb": tmdb_details or [],
                    "watchmode": [],
                    "cast": cast_data.get("cast", [])[:12] or [],
                }
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# GET SEASONS FOR TV SHOWS
@app.route("/tv/seasons", methods=["GET"])
@limiter.limit(TMDB_RATE)
@cache.cached(query_string=True)
def get_tv_seasons():
    tv_id = request.args.get("id")

    if not tv_id:
        return jsonify({"error": "Tv show ID is required"})

    try:
        tv = tmdb.TV(tv_id)
        tv_info = tv.info()
        seasons_data = tv_info.get("seasons")

        # Filter specials unless its the only one there (Some shows have season 0s)
        if len(seasons_data) > 1:
            seasons_data = [s for s in seasons_data if s.get("season_number") != 0]

            return jsonify({"seasons": seasons_data})

    except Exception as e:
        print(f"Error fetching TV seasons: {str(e)}")
        return jsonify({"error": str(e)})


# GET EPISODES FOR SEASONS
@app.route("/tv/seasons/episodes", methods=["GET"])
@limiter.limit(TMDB_RATE)
@cache.cached(query_string=True)
def get_season_episodes():
    tv_id = request.args.get("id")
    season_number = request.args.get("season_number")

    if not tv_id or not season_number:
        return jsonify({"error": "TV show ID and season number are required"})

    try:
        # I got the seasons from the previous endpoint
        # So now all i do is pass the season number and tv id to the TV_Seasons endpoint to get the episodes
        tv_seasons = tmdb.TV_Seasons(tv_id, season_number)
        season = tv_seasons.info()

        return jsonify({"episodes": season.get("episodes", [])})
    except Exception as e:
        print(f"Error fetching season episodes: {str(e)}")
        return jsonify({"error": str(e)})


# GET EPISODE PROGRESS AND SHOW WHICH EPISODES HAVE BEEN WATCHED
# This gets the information from firebase while another function sets it
# The interactions/episode-progress sets the progress information
@app.route("/tv/episode-progress", methods=["GET"])
def get_episode_progress():
    user_id = request.args.get("user_id")
    tv_id = request.args.get("tv_id")

    if not user_id or not tv_id:
        return jsonify({"error": "user ID and TV ID are required"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        tv_progress_key = f"tv_{tv_id}"
        tv_progress_ref = user_ref.collection("tv_progress").document(tv_progress_key)
        tv_doc = tv_progress_ref.get()

        if not tv_doc.exists:
            return jsonify(
                {"progress": {}, "message": "No progress found for this show"}
            )

        progress_data = tv_doc.to_dict()
        return jsonify({"progress": progress_data})

    except Exception as e:
        print(f"Error getting episode progress: {str(e)}")
        return jsonify({"error": f"Failed to get episode progress: {str(e)}"})


# GET CALENDAR ENTRIES
@app.route("/tv/calendar", methods=["GET"])
def get_tv_calendar():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "User ID is required"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})
        # Points to the tv_calendar collection and streams it
        calendar_ref = user_ref.collection("tv_calendar")
        calendar_docs = calendar_ref.stream()

        calendar_entries = []
        for doc in calendar_docs:
            data = doc.to_dict()
            # If a next episode exists and its release is in the future
            if "next_episode" in data and data["next_episode"]["air_date"]:
                air_date = data["next_episode"]["air_date"]
                today = datetime.datetime.now().strftime("%Y-%m-%d")

                # Only shows tv shows with airdates in the future.
                if air_date >= today:
                    # Appends valid entries from firebase to local variable
                    calendar_entries.append(
                        {
                            "id": doc.id,
                            "title": data.get("title"),
                            "media_id": data.get("media_id"),
                            "poster_path": data.get("poster_path"),
                            "season": data["next_episode"].get("season"),
                            "episode": data["next_episode"].get("episode"),
                            "episode_name": data["next_episode"].get("name"),
                            "air_date": air_date,
                            "overview": data["next_episode"].get("overview"),
                        }
                    )
        # Sort by air date
        calendar_entries.sort(key=lambda x: x["air_date"])

        return jsonify({"calendar": calendar_entries})
    except Exception as e:
        print(f"Error retrieving TV calendar: {str(e)}")
        return jsonify({"error": f"Failed to retrieve TV calendar: {str(e)}"})


# UPDATE CALENDAR ENTRIES
# Updates the calendar from collection information
@app.route("/tv/update-calendar", methods=["POST"])
@limiter.limit(TMDB_RATE)
def update_tv_calendar():
    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "User ID is required"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        # Get all the followed shows
        followed_ref = user_ref.collection("followed_media")
        tv_shows = followed_ref.where("media_type", "==", "tv").stream()

        updated_count = 0
        for show in tv_shows:
            show_data = show.to_dict()
            media_id = show_data.get("media_id")

            # Get latest show information
            tv = tmdb.TV(media_id)
            tv_info = tv.info()

            is_ongoing = (
                tv_info.get("status") == "Returning Series"
                or tv_info.get("in_production") == True
            )

            if is_ongoing:
                # Sets the next episode informations for the get function tv/calendar
                next_episode = tv_info.get("next_episode_to_air")
                if next_episode:
                    calendar_ref = user_ref.collection("tv_calendar")
                    calendar_ref.document(f"tv_{media_id}").set(
                        {
                            "media": media_id,
                            "title": show_data.get("title"),
                            "poster_path": tv_info.get("poster_path"),
                            "next_episode": {
                                "season": next_episode.get("season_number"),
                                "episode": next_episode.get("episode_number"),
                                "name": next_episode.get("name"),
                                "air_date": next_episode.get("air_date"),
                                "overview": next_episode.get("overview"),
                            },
                            "last_updated": firestore.SERVER_TIMESTAMP,
                        }
                    )
                    updated_count += 1

                else:
                    # Remove from the calendar if its finished
                    calendar_ref = user_ref.collection("tv_calendar")
                    calendar_doc = calendar_ref.document(f"tv_{media_id}")
                    if calendar_doc.get().exists:
                        calendar_doc.delete()
        return jsonify(
            {
                "status": "success",
                "message": f"Calendar update with {updated_count} shows",
            }
        )
    except Exception as e:
        print(f"Error updating TV calendar: {str(e)}")
        return jsonify({"error": f"Failed to update TV calendar: {str(e)}"})


# RECOMMENDATIONS
@app.route("/recommendations", methods=["POST"])
@limiter.limit(TMDB_RATE)
@cache.cached(timeout=86400, make_cache_key=make_cache_key)
def get_recommendations():  # Unused data for better recommendations.
    data = request.get_json()
    media_id = data.get("id")
    media_type = data.get("type")
    media_overview = data.get("overview", "No overview available")
    media_language = data.get("language", "")
    media_producer_id = data.get("producer_ids", "Unknown").split(",")
    media_genre_id = data.get("genre_ids", "").split(",")
    media_genre_id = list(
        map(int, media_genre_id)
    )  # Converts content to int and back to list
    media_keyword_ids = data.get("keyword_ids", "").split(",")
    media_keyword_ids = list(map(int, media_keyword_ids))

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

    media_info = media_overview

    recommendations.extend(
        expand_pool_with_discover(
            media_genre_id,
            media_keyword_ids,
            media_producer_id,
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

        rec_media_info = media.info()

        keywords_data = media.keywords()
        if rec.get("media_type") == "movie":
            rec_keywords = [k["id"] for k in keywords_data.get("keywords")] or []
        elif rec.get("media_type") == "tv":
            rec_keywords = [k["id"] for k in keywords_data.get("results")] or []

        rec_genres = [r["id"] for r in rec_media_info.get("genres")] or []

        rec_info = rec_media_info.get("overview", "")

        rec_release_date = rec_media_info.get("release_date") or rec_media_info.get(
            "first_air_date"
        )

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

        # For the movie candidate, remove if their languages don't match
        if (
            rec_media_info.get("original_language") != media_language
            and rec_media_info.get("media_type") == "movie"
        ):
            continue

        # Genre similarity check
        if not media_genre_id or not rec_genres:
            genre_sim = 0.1
        else:
            genre_sim = jaccardSim(media_genre_id, rec_genres)
            if genre_sim:
                genre_sim = max(genre_sim, 0.2)

        text_sim = calculate_similarity(
            media_info, rec_info
        )  # Overview similarity check

        if media_keyword_ids and rec_keywords:  # Keyword similarity check
            keyword_sim = jaccardSim(media_keyword_ids, rec_keywords)
        else:
            keyword_sim = 0

        total_score = (
            (genre_sim * 0.3)  # Genre importance: 30%
            + (text_sim * 0.35)  # Text similarity importance: 35%
            + (keyword_sim * 0.2)  # Keyword importance: 20%
            + (rec_media_info.get("popularity", 0) * 0.1)  # Popularity importance: 10%
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


@app.route("/user-recommendations", methods=["GET"])
@limiter.limit(TMDB_RATE)
@cache.cached(timeout=86400, make_cache_key=make_cache_key)
def get_user_recommendations():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Used must be logged in"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        # Get the user interests
        interests_collection = user_ref.collection("interests")
        genres_doc = interests_collection.document("genres").get()
        keywords_doc = interests_collection.document("keywords").get()
        companies_doc = interests_collection.document("production_companies").get()

        # Get the user interests data from the collection
        if genres_doc.exists or keywords_doc.exists or companies_doc.exists:
            user_genres = [g.get("id") for g in genres_doc.to_dict().get("items", [])]
            user_keywords = [
                k.get("id") for k in keywords_doc.to_dict().get("items", [])
            ]
            user_companies = [
                c.get("id") for c in companies_doc.to_dict().get("items", [])
            ]
        else:
            # If there are no interests then they are set to empty so nothing breaks
            user_genres = []
            user_keywords = []
            user_companies = []

        # Passes to the expand pool function to get search results for interests
        # Same function used to make the recommendation pool bigger in general recommendations
        movie_results = expand_pool_with_discover(
            user_genres, user_keywords, user_companies, "movie"
        )
        tv_results = expand_pool_with_discover(
            user_genres, user_keywords, user_companies, "tv"
        )

        sorted_movie_results = sorted(
            movie_results, key=lambda x: x.get("popularity", 0), reverse=True
        )
        sorted_tv_results = sorted(
            tv_results, key=lambda x: x.get("popularity", 0), reverse=True
        )

        return jsonify(
            {"movie_recs": sorted_movie_results[:4], "tv_recs": sorted_tv_results[:4]}
        )

    except Exception as e:
        print(f"Error getting user recommendations: {str(e)}")
        return jsonify({"error": str(e)})


@app.route("/cache_stats")
def cache_stats():
    return jsonify(
        {
            "size": cache.cache._cache.__len__(),
        }
    )


# FOR UPDATING EPISODE PROGRESS FROM FIRESTORE FOR USER
# This is the method that sets episode progress when user sets episode as watched
@app.route("/interactions/episode-progress", methods=["POST"])
def update_episode_progress():
    data = request.get_json()
    user_id = data.get("user_id")
    tv_id = data.get("tv_id")
    season_number = data.get("season_number")
    episode_number = data.get("episode_number")
    watched = data.get("watched")

    if not user_id or not tv_id or season_number is None or episode_number is None:
        return jsonify({"error": "Missing requred parameteres"})

    try:
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        tv_progress_key = f"tv_{tv_id}"

        # Get users TV progress collection
        tv_progress_ref = user_ref.collection("tv_progress").document(tv_progress_key)

        # Check if document exists
        tv_doc = tv_progress_ref.get()
        if tv_doc.exists:
            progress_data = tv_doc.to_dict()
            # Get the seasons information from the firestore
            seasons = progress_data.get("seasons", {})

            # Convert season number to string for use as dictionary key
            season_key = str(season_number)
            if season_key not in seasons:
                # Create new season field if it doesnt exist
                seasons[season_key] = {"episodes": {}}

            # Convert episode number to string for use as dictionary key
            episode_key = str(episode_number)
            # Create a new episode field initalized as what every watched is
            seasons[season_key]["episodes"][episode_key] = {
                "watched": watched,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }

            tv_progress_ref.update(
                {"seasons": seasons, "updated_at": firestore.SERVER_TIMESTAMP}
            )
        # Create a new document if it doesn't exist
        else:
            tv_data = {
                "tv_id": tv_id,
                "seasons": {
                    str(season_number): {
                        "episodes": {
                            str(episode_number): {
                                "watched": watched,
                                "updated_at": firestore.SERVER_TIMESTAMP,
                            }
                        }
                    }
                },
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
            tv_progress_ref.set(tv_data)
        return jsonify({"status": "success", "message": "Episode progress updated"})
    except Exception as e:
        print(f"Error updating episode progress: {str(e)}")
        return jsonify({"error": f"Failed to update episode progress: {str(e)}"})


# FOR Following MEDIA IN SEARCH
# Also adds show to calendar if valid
@app.route("/interactions/media_followed", methods=["POST"])
def handle_media_follow():
    data = request.get_json()
    user_id = data.get("user_id")
    media_id = data.get("media_id")
    media_type = data.get("media_type")
    title = data.get("title")
    genres = data.get("genres", [])
    keywords = data.get("keywords", [])
    production_companies = data.get("producers", [])
    action = data.get("action", "follow")  # Track follow or unfollow

    if not user_id or not media_id:
        return jsonify({"error": "User ID and Media ID are required"})

    user_ref = users_ref.document(user_id)  # Points to the specific user document
    user_doc = user_ref.get()

    if not user_doc.exists:
        return jsonify({"error": "User not found"})

    followed_media_ref = user_ref.collection("followed_media")
    media_key = f"{media_type}_{media_id}"

    # Following media add genres and keywords for recommendations later
    if (
        action == "follow"
    ):  # Add movie/Show to followed_media collection under specfic user
        followed_media_ref.document(media_key).set(
            {  # media key acts as the unique id since i am defining it manually.
                "media_id": media_id,
                "media_type": media_type,
                "title": title,
                "genres": genres,
                "keywords": keywords,
                "production_companies": production_companies,
                "timestamp": firestore.SERVER_TIMESTAMP,
            }
        )

        update_user_interests(user_ref, genres, keywords, production_companies, "add")

        if action == "follow" and media_type == "tv":
            try:
                tv = tmdb.TV(media_id)
                tv_info = tv.info()

                # Check if the show is still going
                is_ongoing = (
                    tv_info.get("status") == "Returning Series"
                    or tv_info.get("in_production") == True
                )

                if is_ongoing:
                    # Add to the calendar
                    calendar_ref = user_ref.collection("tv_calendar")
                    # Get the next episode if available
                    next_episode = tv_info.get("next_episode_to_air")
                    if next_episode:
                        calendar_ref.document(f"tv_{media_id}").set(
                            {
                                "media_id": media_id,
                                "title": title,
                                "poster_path": tv_info.get("poster_path"),
                                "next_episode": {
                                    "season": next_episode.get("season_number"),
                                    "episode": next_episode.get("episode_number"),
                                    "name": next_episode.get("name"),
                                    "air_date": next_episode.get("air_date"),
                                    "overview": next_episode.get("overview"),
                                },
                                "last_updated": firestore.SERVER_TIMESTAMP,
                            }
                        )
            except Exception as e:
                print(f"Error adding show to calendar: {str(e)}")
        return jsonify({"status": "success", "message": "Media followed successfully"})

    elif (
        action == "unfollow"
    ):  # In the event of an unfollow, media is removed along with keywords and genres of media
        media_doc = followed_media_ref.document(media_key).get()
        if not media_doc.exists:
            return jsonify({"error": "Media was never followed"})

        media_data = media_doc.to_dict()
        removed_genres = media_data.get("genres", [])
        removed_keywords = media_data.get("keywords", [])
        removed_companies = media_data.get("production_companies", [])

        followed_media_ref.document(media_key).delete()

        update_user_interests(
            user_ref, removed_genres, removed_keywords, removed_companies, "remove"
        )

        if action == "unfollow" and media_type == "tv":
            calendar_ref = user_ref.collection("tv_calendar")
            calendar_doc = calendar_ref.document(f"tv_{media_id}")
            if calendar_doc.get().exists:
                calendar_doc.delete()
        return jsonify(
            {"status": "success", "message": "Media unfollowed successfully"}
        )

    else:
        return jsonify({"error": "Invalid action"})


# FOR KEEPING FOLLOWED STATUS
@app.route("/interactions/check_followed", methods=["GET"])
def check_if_media_followed():
    user_id = request.args.get("user_id")
    media_id = request.args.get("media_id")
    media_type = request.args.get("media_type")

    if not user_id or not media_id or not media_type:
        return jsonify({"error": "User ID, Media ID, and Media Type are required"})

    user_ref = users_ref.document(user_id)
    if not user_ref.get().exists:
        return jsonify({"error": "User not found"})

    media_key = f"{media_type}_{media_id}"
    followed_media_doc = user_ref.collection("followed_media").document(media_key).get()

    return jsonify({"followed": followed_media_doc.exists})


# FOR ADDING TO WATCHLIST
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
        return jsonify({"error": "Failed to add to watchlist"})


# FOR GETTING WATCHLISTS
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


# FOR GETTING ALL WATCHLIST MEDIA
@app.route("/interactions/get-watchlist-media", methods=["GET"])
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


# FOR REMOVING MEDIA FROM WATCHLIST
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


# FOR DELETING ENTIRE WATCHLIST
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
        # Start by deleting the media subcollection
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


# FOR GETTING MEDIA STATUS IN WATCHLIST
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


@app.route("/interactions/get-ratings", methods=["GET"])
def get_ratings():
    user_id = request.args.get("user_id")
    media_id = int(request.args.get("media_id"))
    media_type = request.args.get("media_type")

    user_ref = users_ref.document(user_id)
    if not user_ref.get().exists:
        return jsonify({"error": "User not found"})

    try:

        ratings_ref = db.collection("Ratings")
        query_ref = (
            ratings_ref.where("user_id", "==", user_id)
            .where("media_id", "==", media_id)
            .where("media_type", "==", media_type)
        )
        ratings = list(query_ref.get())
        if not ratings:
            return jsonify(
                {
                    "rating": 0,
                    "averageRating": 0,
                    "message": "No rating found for this media",
                }
            )

        rating_doc = ratings[0]
        rating_data = rating_doc.to_dict()

        return jsonify(
            {
                "rating": rating_data.get("rating"),
                "averageRating": rating_data.get("averageRating"),
                "message": "Successfully found rating",
            }
        )

    except Exception as e:
        print(f"Error getting rating: {str(e)}")
        return jsonify({"error": f"Failed to geting rating: {str(e)}"})


if __name__ == "__main__":
    app.run(port=5000, debug=True)  # Starts the Flask app and sets the port.
