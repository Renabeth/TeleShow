import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from flask import Flask, request, jsonify  # Allows for the creating of API endpoints
from flask_cors import CORS  # CORS allows for cross-origin requests
from flask_caching import Cache  # For caching API Queries
import requests  # For sending requests to urls
import json  # For Parsing JSON files (Flask uses its own jsonify function)
import os  # Used to find file paths

app = Flask(__name__)  # Initializes Flask

CORS(app, origins=["http://localhost:3000"])  # Initializes CORS

# Initializes Cache with a default ttl of 30 minutes
cache = Cache(
    app,
    config={
        "CACHE_TYPE": "SimpleCache",
        "CACHE_THRESHOLD": 1000,
        "CACHE_DEFAULT_TIMEOUT": 1800,
    },
)


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


@cache.memoize(1800)  # Initializes cache for function
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
                    return sorted(
                        sources, key=lambda x: x["name"]
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
                    return sorted(sources, key=lambda x: x["name"])
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


def calculate_relevance(
    item, query
):  # Makes sure that items with the query in the name get precidence
    base_score = item.get("popularity", 0)
    title = item.get("title", "") or item.get("name", "")
    if query.lower() in title.lower():
        base_score *= 1.5  # Boost items with query in title
    if title.lower() == query.lower():
        base_score *= 2  # Further boost exact matches
    return base_score


@app.route("/")  # What happens when someone visits the default path.
def home():
    return "Hello, User!"


@cache.cached(query_string=True)  # initializes cache for view function
@app.route(
    "/search", methods=["GET"]
)  # What happens when someone visits the /search endpoint of this Flask API
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
                    movie_results, key=lambda x: x.get("popularity", 0), reverse=True
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


@cache.cached(query_string=True)
@app.route(
    "/search/details", methods=["GET"]
)  # Search/details enpoint (this handles the extra data given when you click a result)
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
                watchmode_data = watchmode_search(
                    item_id, item_type
                )  # Passes the tmdb_id and type to watchmode search function
            elif item_type == "tv":
                media = tmdb.TV(item_id)
                watchmode_data = watchmode_search(item_id, item_type)
            tmdb_details = media.info()  # Gets detailed information from TMDB
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


@app.route("/cache_stats")
def cache_stats():
    return jsonify(
        {
            "size": cache.cache._cache.__len__(),
        }
    )


if __name__ == "__main__":
    app.run(port=5000, debug=True)  # Starts the Flask app and sets the port.
