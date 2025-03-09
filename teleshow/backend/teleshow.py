import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from flask import Flask, request, jsonify  # Allows for the creating of API endpoints
from flask_cors import CORS  # CORS allows for cross-origin requests
from flask_caching import Cache  # For caching API Queries
from flask_limiter import Limiter  # Rate Limiting
from flask_limiter.util import get_remote_address
import requests  # For sending requests to urls
import json  # For Parsing JSON files (Flask uses its own jsonify function)
import os  # Used to find file paths
import datetime
import torch

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

script_dir = os.path.dirname(os.path.abspath(__file__))  # Loads the API key
json_path1 = os.path.join(script_dir, "Resources", "tmdb_api_key.json")
json_path2 = os.path.join(script_dir, "Resources", "watchmode_api_key.json")

with open(
    json_path1, "r"
) as file:  # Opens and parses file based on path given from the variables created above.
    data1 = json.load(file)
with open(json_path2, "r") as file:
    data2 = json.load(file)

base_url1 = "https://api.watchmode.com/v1"  # Base API urls used to create full urls for API calls.
image_url = "https://image.tmdb.org/t/p/w500"  # Base Image urls

tmdb.API_KEY = data1.get("api_key")  # Sets the API key using the tmdbsimple library
api_key1 = data2.get("api_key")  # Saves the watchmode API to a variable

model = SentenceTransformer(
    "all-MiniLM-L12-v2"
)  # Sets the model for Senetence Transformer


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

@cache.memoize(3600)
def calculate_similarity(overview1, overview2):
    # Turns text into numerical vector representations
    embedding1 = model.encode(
        overview1, convert_to_tensor=True
    )  
    embedding2 = model.encode(
        overview2, convert_to_tensor=True, batch_size=32
    )

    # Performs calculation to find how similiar text segments are. 1 = identical and close to 0 means different
    return torch.dot(
        embedding1, embedding2
    ).item()  

def calculate_relevance(
    item, query
):  # Makes sure that items with the query in the name get precidence
    
    if item.get("popularity") < 3 and item.get("vote_count") < 20: #If the its not popular and doesn't have a lot of votes put on the bottom
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
        "release_date.gte": "2000-01-01",
        "original_language": "en",
        "vote_average.gte": 7
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


@app.route("/")  # What happens when someone visits the default path.
def home():
    return "Hello, User!"


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
            # watchmode_data = watchmode_search(
            #    item_id, item_type
            # )  # Passes the tmdb_id and type to watchmode search function
            elif item_type == "tv":
                media = tmdb.TV(item_id)
                keywords_data = media.keywords()
            #   watchmode_data = watchmode_search(item_id, item_type)

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


@app.route("/recommendations", methods=["GET"])
@limiter.limit(TMDB_RATE)
@cache.cached(timeout=86400, query_string=True)
def get_recommendations():  # Unused data for better recommendations.
    media_id = request.args.get("id")
    media_type = request.args.get("type")
    media_overview = request.args.get("overview", "No overview available")
    media_tagline = request.args.get("tagline", "No tagline available")
    media_language = request.args.get("language", "")
    media_region = request.args.get("region","")
    media_producer_id = request.args.get("producer_ids", "Unknown").split(",")
    media_cast_id = request.args.get("cast_ids", "No cast information").split(",")
    media_genre_id = request.args.get("genre_ids", "").split(",")
    media_genre_id = list(map(int, media_genre_id)) #Converts content to int and back to list
    media_keyword_id = request.args.get("keyword_ids", "").split(",")
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

    for rec in recommendations:
        print(rec.get("name") or rec.get("title"))

    print("<After>")

    recommendations.extend(
        expand_pool_with_discover(
            media_genre_id,
            media_keyword_id,
            media_producer_id,
            media_cast_id,
            media_type,
        )
    )

    for rec in recommendations:
        print(rec.get("name") or rec.get("title"))

    for rec in recommendations:  # Prevent duplicate recommendations
        unique_key = f"{rec.get('id')}-{rec.get('media_type')}"
        if unique_key not in x and rec.get("id") != int(media_id): #Make sure we dont get the original media in recommendations
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

        rec_data = {  #Framework for more data to use if needed. We would have to pass more from frontend to match
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
            "origin_country": info.get("origin_country",[]),
            "origin_language": info.get("origin_language",[])
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
            
        #Region Check
        first_country = rec_data.get("origin_country", [None])[0]
        if rec_data.get("original_language") != media_language and first_country != media_region:
            continue

        if not media_genre_id or not rec_genres:
            genre_sim = 0.1
        else: #Genre similarity check
            #Jaccard Similarity = |Intersection| / |Union|
            #Intersection is the elements that appear in both
            #Union is all the elements 
            common_genres = set(media_genre_id).intersection(set(rec_genres))
            genre_sim = len(common_genres) / len(set(media_genre_id).union(set(rec_genres)))
            if common_genres:
                genre_sim = max(genre_sim, 0.2)

        text_sim = calculate_similarity(media_info, rec_info) #Text similarity check

        rec_keywords = list(
            map(int, [rec["id"] for rec in rec_data.get("keywords", [])]) 
        )
        if media_keyword_id and rec_keywords: #Keyword similarity check
            common_keywords = set(media_keyword_id) & set(rec_keywords)
            keyword_sim = len(common_keywords) / len(set(media_keyword_id).union(set(rec_keywords)))
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
            {
                "recommendations": tmdb.Movies().popular()["results"][:8] or []
            }
        )


@app.route("/cache_stats")
def cache_stats():
    return jsonify(
        {
            "size": cache.cache._cache.__len__(),
        }
    )


if __name__ == "__main__":
    app.run(port=5000, debug=True)  # Starts the Flask app and sets the port.
