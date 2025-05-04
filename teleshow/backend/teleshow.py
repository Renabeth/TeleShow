# Written by Moses Pierre
from flask import Flask, jsonify, redirect
import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from flask_cors import CORS  # CORS allows for cross-origin requests
from app.blueprints.search import search_bp
from app.blueprints.recommendations import recommendations_bp
from app.blueprints.interactions import interactions_bp
from app.extensions import cache, limiter, init_app
import os  # Used to find file paths
import sys
import logging
import atexit
import signal
from app.firebase_handler import shutdown_all_listeners

if getattr(sys, "frozen", False):
    # Running as executable
    static_folder = os.path.join(sys._MEIPASS, "app", "static")
    template_folder = os.path.join(sys._MEIPASS, "app", "templates")
    app = Flask(__name__, static_folder=static_folder, template_folder=template_folder)
else:
    # Running as script
    app = Flask(__name__)

init_app(app)
app.register_blueprint(search_bp, url_prefix="/search")
app.register_blueprint(interactions_bp, url_prefix="/interactions")
app.register_blueprint(recommendations_bp)


logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Initializes CORS
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:5000", "file://*"])


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
    if getattr(sys, "frozen", False):
        return app.send_static_file("index.html")
    else:
        return redirect("http://localhost:3000")  # Redirects to proper url


@app.route("/logo.png")
def get_logo():
    if getattr(sys, "frozen", False):
        return app.send_static_file("Logo.png")


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


@app.errorhandler(404)
def not_found(e):
    if getattr(sys, "frozen", False):
        return app.send_static_file("index.html")
    else:
        return redirect("http://localhost:3000")


atexit.register(shutdown_all_listeners)


def _graceful_shutdown(signum, frame):
    shutdown_all_listeners()
    sys.exit(0)


signal.signal(signal.SIGINT, _graceful_shutdown)
signal.signal(signal.SIGTERM, _graceful_shutdown)

if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        app.run(port=5000, debug=False)
    else:
        app.run(port=5000, debug=True)
