from flask_caching import Cache  # For caching API Queries
from flask_limiter import Limiter  # Rate Limiting
from flask_limiter.util import get_remote_address
import firebase_admin  # Firebase imports that allow connection to firestore for user data
import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from firebase_admin import credentials
from firebase_admin import firestore
import os  # Used to find file paths
import sys

# Loads .env files (Flask does this automatically but explicit statement give more control)
from dotenv import load_dotenv

cache = Cache()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    strategy="fixed-window",
    default_limits=["200 per minute"],
)

"https://flask-lazyviews.readthedocs.io/en/latest/"
# Lazy loading method
db = None
model = None


# This checks whether the python application is running a 'frozen' executable or a script
# The default value is set to false if the attribute doesn't exist
if getattr(sys, "frozen", False):
    # Running as executable
    # Set to the directory containing the executable file
    base_path = sys._MEIPASS
    dotenv_path = os.path.join(sys._MEIPASS, ".env")
# For PyInstaller temporary directory
# MEIPASS is a special temporary directory PyInstaller creates at runtime where it extracts all the bundled files needed by your application

else:
    # Running as script
    # Set to the directory containing the current script file
    base_path = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

load_dotenv(dotenv_path=dotenv_path)


def get_watchmode_key():
    watchmode_key = os.getenv("PY_WATCHMODE_API_KEY")
    return watchmode_key


def get_db():
    global db
    if db is None:
        # Gets the firebase keyfile
        firebase_key = os.path.join(
            base_path, "app", "Resources", "teleshow-firebase.json"
        )
        cred = credentials.Certificate(firebase_key)  # Firebase initialization
        firebase_admin.initialize_app(cred)
        db = firestore.client()
    return db


def get_model():
    global model
    if model is None:
        # Generates a numerical representation (embedding) for the entire sentence or paragraph, enabling it to measure semantic similarity efficiently.
        from sentence_transformers import SentenceTransformer

        # Sets the pre-trained learning model for Sentence Transformer
        model = SentenceTransformer(
            "sentence-transformers/static-similarity-mrl-multilingual-v1"
        )

    return model


def init_app(app):
    # Initializes Cache with a default ttl of 30 minutes
    cache.init_app(
        app,
        config={
            "CACHE_TYPE": "SimpleCache",
            "CACHE_THRESHOLD": 2000,
            "CACHE_DEFAULT_TIMEOUT": 3600,
        },
    )

    # Initializes the Flask limiter. Helps avoid the rate limiters for TMDB and Wathmode
    limiter.init_app(app)

    # Sets the API key using the tmdbsimple library
    tmdb.API_KEY = os.getenv("PY_TMDB_API_KEY")
