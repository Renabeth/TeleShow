from flask_caching import Cache  # For caching API Queries
from flask_limiter import Limiter  # Rate Limiting
from flask_limiter.util import get_remote_address
import firebase_admin  # Firebase imports that allow connection to firestore for user data
from firebase_admin import credentials
from firebase_admin import firestore
import os  # Used to find file paths

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


def get_db():
    global db
    if db is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Gets the firebase keyfile
        firebase_key = os.path.join(script_dir, "Resources", "teleshow-firebase.json")
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
