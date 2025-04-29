# Written by Moses Pierre
from flask_caching import Cache  # For caching API Queries
from flask_limiter import Limiter  # Rate Limiting
from flask_compress import Compress
from flask_limiter.util import get_remote_address
import firebase_admin  # Firebase imports that allow connection to firestore for user data
from firebase_admin import credentials
from firebase_admin import firestore
import os  # Used to find file paths
import threading
import time

cache = Cache()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    strategy="fixed-window",
    default_limits=["200 per minute"],
)
compress = Compress()

# Global Variables
db = None
model = None
model_loading = False
# Events are use to tell other threads that something has happened
model_load_complete = threading.Event()


# The function that will be run by the thread
def load_model_task():
    # Meant to load sentence transformer model in the background
    global model, model_loading
    try:
        print("Beginning to load sentence transformer model...")
        start_time = time.time()
        # Generates a numerical representation (embedding) for the entire sentence or paragraph, enabling it to measure semantic similarity efficiently.
        from sentence_transformers import SentenceTransformer

        # Sets the pre-trained learning model for Sentence Transformer
        model = SentenceTransformer(
            "sentence-transformers/static-similarity-mrl-multilingual-v1"
        )
        elapsed = time.time() - start_time
        print(f"Sentence transformer model loaded successfully in {elapsed:2f} seconds")
    except Exception as e:
        print(f"Error loading model: {e}")
    finally:
        model_loading = False
        # .set() indicates that the event has finished and that other processes that were waiting can continue.
        model_load_complete.set()


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
    # This function is used in the recommendations.py
    # it attempts to get the model but it will wait if its loading
    global model, model_loading
    if model is None and not model_loading:
        print("Model not loading yet, starting soon")
        model_loading = True
        load_model_task()
    # If the model isn't finished loading its going to wait with a 60 second timeout
    if not model_load_complete.is_set():
        print("Waiting for model to finish initializing...")
        model_load_complete.wait(timeout=60)

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

    compress.init_app(app)

    # Configures compression
    app.config["COMPRESS_MIMETYPES"] = [
        "text/html",
        "text/css",
        "text/xml",
        "application/json",
        "application/javascript",
    ]
    app.config["COMPRESS_LEVEL"] = 6  # Higher compression level 1-9
    app.config["COMPRESS_MIN_SIZE"] = (
        500  # Only compresses responses larger than 500 bytes
    )

    global model_loading
    # Checks is the model is loading.
    if not model_loading and model is None:
        print("Starting background thread to load transformer model")
        # Sets the model_loading to true
        model_loading = True
        # Creates a thread that runs the load_model_task function
        # Sets the daemon to true so that the thread will quit when the process terminates
        # If false then the process will wait for thread to complete before terminating
        # Then the thread is started
        model_thread = threading.Thread(target=load_model_task)
        model_thread.daemon = True
        model_thread.start()
