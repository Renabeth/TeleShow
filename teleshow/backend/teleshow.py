# Written by Moses Pierre
from flask import Flask, jsonify, redirect
import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from flask_cors import CORS  # CORS allows for cross-origin requests
from search import search_bp
from recommendations import recommendations_bp
from interactions import interactions_bp
from extensions import cache, limiter, init_app

# Loads .env files (Flask does this automatically but explicit statement give more control)
from dotenv import load_dotenv
import os  # Used to find file paths


app = Flask(__name__)
init_app(app)
app.register_blueprint(search_bp, url_prefix="/search")
app.register_blueprint(interactions_bp, url_prefix="/interactions")
app.register_blueprint(recommendations_bp)


CORS(app, origins=["http://localhost:3000"])  # Initializes CORS
load_dotenv()  # Explicit loading of .env file in working directory to avoid problems

# Sets the API key using the tmdbsimple library
tmdb.API_KEY = os.getenv("PY_TMDB_API_KEY")


@app.route("/cache_stats")
def cache_stats():
    return jsonify(
        {
            "size": cache.cache._cache.__len__(),
        }
    )


# What happens when someone visits the default path.
@app.route("/")
def home():
    return redirect("http://localhost:3000")  # Redirects to proper url


# Trending content for the home page
@app.route("/trending", methods=["GET"])
@limiter.limit("10 per 5 seconds")
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


if __name__ == "__main__":
    app.run(port=5000, debug=True)
