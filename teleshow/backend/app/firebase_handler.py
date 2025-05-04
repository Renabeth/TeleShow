import threading
import time
from google.cloud.firestore_v1.base_query import FieldFilter
from app.extensions import get_db
import logging

# Moses's Overview
# The cache functions check if the information is in the cache. If not then the data is retrieved from firebase with a listener attached for changes.
# https://firebase.google.com/docs/firestore/query-data/listen#python_1

logger = logging.getLogger(__name__)

user_cache = {}
ratings_cache = {}
comments_cache = {}
followed_media_cache = {}
watchlist_cache = {}
tv_progress_cache = {}
active_listeners = {}
MAX_ACTIVE_LISTENERS = 50
EVICTION_MAP = {
    "user_": user_cache,
    "ratings_": ratings_cache,
    "comments_": comments_cache,
    "watchlists_": watchlist_cache,
    "followed_": followed_media_cache,
    "tv_progress_": tv_progress_cache,
}

cache_lock = threading.RLock()
listener_lock = threading.RLock()

listener_shutdown_event = threading.Event()
listener_thread = None

users_ref = get_db().collection("users-test")


def get_cached_user_data(user_id):
    """Gets user data from cache or set up listener if not available"""
    initial_data_event = threading.Event()
    listener_key = f"user_{user_id}"
    user_ref = users_ref.document(user_id)

    def on_snapshot(doc_snapshot, changes, read_time):
        try:
            with cache_lock:
                for doc in doc_snapshot:
                    user_cache[user_id] = doc.to_dict()
                    logger.info(f"User document updated for {user_id}")
                    with listener_lock:
                        if listener_key in active_listeners:
                            active_listeners[listener_key]["last_active"] = time.time()
        except Exception as e:
            logger.error(f"Error in user snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    with listener_lock:
        # Sets up the document listener
        if user_id in user_cache and listener_key in active_listeners:
            info = active_listeners.get(listener_key)
            if info:
                info["last_active"] = time.time()
            return user_cache[user_id]

        if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
            msg = f"user listener cap reached ({MAX_ACTIVE_LISTENERS})"
            logger.error(msg)
            raise RuntimeError(msg)
        if listener_key in active_listeners:
            active_listeners[listener_key]["last_active"] = time.time()
            return user_cache.get(user_id, {})

        listener = user_ref.on_snapshot(on_snapshot)
        active_listeners[listener_key] = {
            "listener": listener,
            "last_active": time.time(),
        }

    initial_data_event.wait(timeout=5.0)
    return user_cache.get(user_id, {})


def get_cached_user_ratings(user_id):
    """Gets user ratings from cache or set up listener if not available"""
    initial_data_event = threading.Event()
    listener_key = f"ratings_{user_id}"
    logger.info(f"Setting up ratings listener for {user_id}")
    ratings_ref = get_db().collection("Ratings")
    query = ratings_ref.where("user_id", "==", user_id)

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                ratings = {
                    f"{d.to_dict()['media_type']}_{d.to_dict()['media_id']}": d.to_dict()
                    for d in query_snapshot
                }
                ratings_cache[user_id] = ratings
                logger.info(f"Ratings cached for {user_id}")
            with listener_lock:
                if listener_key in active_listeners:
                    active_listeners[listener_key]["last_active"] = time.time()
        except Exception as e:
            logger.error(f"Error in ratings snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    with listener_lock:
        if user_id in ratings_cache and listener_key in active_listeners:
            info = active_listeners.get(listener_key)
            if info:
                info["last_active"] = time.time()
            return ratings_cache[user_id]
        if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
            msg = f"Max listeners ({MAX_ACTIVE_LISTENERS}) reached, cannot subscribe {listener_key}"
            logger.error(msg)
            raise RuntimeError(msg)
        if listener_key in active_listeners:
            active_listeners[listener_key]["last_active"] = time.time()
            return ratings_cache.get(user_id, {})

        listener = query.on_snapshot(on_snapshot)
        active_listeners[listener_key] = {
            "listener": listener,
            "last_active": time.time(),
        }
    initial_data_event.wait(timeout=5.0)
    return ratings_cache.get(user_id, {})


def get_cached_user_comments(user_id):
    """Gets user comments from cache or set up listener if not available"""
    listener_key = f"comments_{user_id}"
    initial_data_event = threading.Event()

    logger.info(f"Setting up comments listener for {user_id}")
    comments_ref = get_db().collection("Comments")
    query = comments_ref.where(filter=FieldFilter("user_id", "==", user_id))

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                if not changes:
                    comments_cache[user_id] = [
                        {"id": doc.id, **doc.to_dict()} for doc in query_snapshot
                    ]
                else:
                    if user_id not in comments_cache:
                        comments_cache[user_id] = []

                    for change in changes:
                        if change.type.name == "ADDED":
                            comments_cache[user_id].append(
                                {
                                    "id": change.document.id,
                                    **change.document.to_dict(),
                                }
                            )
                        elif change.type.name == "MODIFIED":
                            # Updates existing comment
                            for i, comment in enumerate(comments_cache[user_id]):
                                if comment["id"] == change.document.id:
                                    comments_cache[user_id][i] = {
                                        "id": change.document.id,
                                        **change.document.to_dict(),
                                    }
                        elif change.type.name == "REMOVED":
                            # Removes deleted comment
                            comments_cache[user_id] = [
                                c
                                for c in comments_cache[user_id]
                                if c["id"] != change.document.id
                            ]

                logger.info(f"Comments cache updated for {user_id}")

            with listener_lock:
                if listener_key in active_listeners:
                    active_listeners[listener_key]["last_active"] = time.time()
        except Exception as e:
            logger.error(f"Error in comments snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    with listener_lock:
        if user_id in comments_cache and listener_key in active_listeners:
            info = active_listeners.get(listener_key)
            if info:
                info["last_active"] = time.time()
            return comments_cache.get(user_id, [])
        if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
            msg = f"{listener_key} cap reached ({MAX_ACTIVE_LISTENERS})"
            logger.error(msg)
            raise RuntimeError(msg)
        if listener_key in active_listeners:
            active_listeners[listener_key]["last_active"] = time.time()
            return comments_cache.get(user_id, [])
        listener = query.on_snapshot(on_snapshot)
        active_listeners[f"comments_{user_id}"] = {
            "listener": listener,
            "last_active": time.time(),
        }

    initial_data_event.wait(timeout=5.0)
    return comments_cache.get(user_id, [])


def get_cached_user_watchlists(user_id):
    """Gets user watchlists from cache or set up listener if not available"""
    listener_key = f"watchlists_{user_id}"
    initial_data_event = threading.Event()
    logger.info(f"Setting up watchlists listener for {user_id}")
    watchlist_ref = users_ref.document(user_id).collection("watchlists")

    def on_snapshot(query_snapshot, changes, read_time):

        try:
            with cache_lock:
                to_add = []  # watchlist_ids that need media listeners
                to_remove = []  # watchlist_ids whose media listeners must be detached
                if user_id not in watchlist_cache:
                    watchlist_cache[user_id] = []

                if not changes:
                    watchlist_cache[user_id] = [
                        {"id": doc.id, **doc.to_dict()} for doc in query_snapshot
                    ]

                    for wl in watchlist_cache[user_id]:
                        key = f"watchlist_media_{user_id}_{wl['id']}"
                        if key not in active_listeners:
                            setup_watchlist_media_listener(user_id, wl["id"])
                else:
                    for change in changes:
                        data = {"id": change.document.id, **change.document.to_dict()}

                        if change.type.name == "ADDED":
                            watchlist_cache[user_id].append(data)
                            to_add.append(data["id"])

                        elif change.type.name == "MODIFIED":
                            for i, wl in enumerate(watchlist_cache[user_id]):
                                if wl["id"] == data["id"]:
                                    watchlist_cache[user_id][i] = data
                                    break

                        elif change.type.name == "REMOVED":
                            watchlist_cache[user_id] = [
                                wl
                                for wl in watchlist_cache[user_id]
                                if wl["id"] != data["id"]
                            ]
                            to_remove.append(data["id"])

                logger.info(f"Watchlists cache updated for {user_id}")
            with listener_lock:
                if listener_key in active_listeners:
                    active_listeners[listener_key]["last_active"] = time.time()
                for wl_id in to_remove:
                    media_key = f"watchlist_media_{user_id}_{wl_id}"
                    detach_listener(media_key)
                for wl_id in to_add:
                    setup_watchlist_media_listener(user_id, wl_id)
        except Exception as e:
            logger.error(f"Error in watchlists snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    with listener_lock:
        if user_id in watchlist_cache and listener_key in active_listeners:
            info = active_listeners.get(listener_key)
            if info:
                info["last_active"] = time.time()
            return watchlist_cache.get(user_id, [])
        if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
            msg = f"{listener_key} cap reached ({MAX_ACTIVE_LISTENERS})"
            logger.error(msg)
            raise RuntimeError(msg)
        if listener_key in active_listeners:
            active_listeners[listener_key]["last_active"] = time.time()
            return watchlist_cache.get(user_id, [])
        listener = watchlist_ref.on_snapshot(on_snapshot)
        active_listeners[f"watchlists_{user_id}"] = {
            "listener": listener,
            "last_active": time.time(),
        }

    initial_data_event.wait(timeout=5.0)
    return watchlist_cache.get(user_id, [])


def setup_watchlist_media_listener(user_id, watchlist_id):
    """Creates real-time listener for media in a specific watchlist"""
    listener_key = f"watchlist_media_{user_id}_{watchlist_id}"

    try:
        logger.info(f"Setting up media listener for watchlist {watchlist_id}")
        media_ref = (
            users_ref.document(user_id)
            .collection("watchlists")
            .document(watchlist_id)
            .collection("media")
        )

        def on_snapshot(query_snapshot, changes, read_time):
            try:
                with cache_lock:
                    if user_id not in watchlist_cache:
                        watchlist_cache[user_id] = []

                    target_watchlist = None
                    for wl in watchlist_cache[user_id]:
                        if wl["id"] == watchlist_id:
                            target_watchlist = wl
                            break

                    if target_watchlist is None:
                        logger.error(
                            f"Watchlist {watchlist_id} not found for user {user_id}"
                        )
                        return

                    if "media" not in target_watchlist:
                        target_watchlist["media"] = []
                        logger.info(
                            f"Initialized media array for watchlist {watchlist_id}"
                        )

                    if not changes:
                        media_items = [
                            {"id": doc.id, **doc.to_dict()} for doc in query_snapshot
                        ]
                        target_watchlist["media"] = media_items
                        logger.info(
                            f"Loaded {len(media_items)} media items for watchlist {watchlist_id}"
                        )
                    else:
                        for change in changes:
                            media_data = {
                                "id": change.document.id,
                                **change.document.to_dict(),
                            }

                            if change.type.name == "ADDED":
                                target_watchlist["media"].append(media_data)
                            elif change.type.name == "MODIFIED":
                                # Updates existing media
                                for i, m in enumerate(target_watchlist["media"]):
                                    if m["id"] == change.document.id:
                                        target_watchlist["media"][i] = media_data
                            elif change.type.name == "REMOVED":
                                # Removes deleted media
                                target_watchlist["media"] = [
                                    m
                                    for m in target_watchlist["media"]
                                    if m["id"] != change.document.id
                                ]

                    logger.info(f"Media cache updated for watchlist {watchlist_id}")

                with listener_lock:
                    if listener_key in active_listeners:
                        active_listeners[listener_key]["last_active"] = time.time()
            except Exception as e:
                logger.error(f"Error in watchlist media snapshot listener: {str(e)}")

        with listener_lock:
            if listener_key in active_listeners:
                active_listeners[listener_key]["last_active"] = time.time()
                return
            if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
                msg = f"{listener_key} cap reached ({MAX_ACTIVE_LISTENERS})"
                logger.error(msg)
                raise RuntimeError(msg)
            listener = media_ref.on_snapshot(on_snapshot)
            active_listeners[listener_key] = {
                "listener": listener,
                "last_active": time.time(),
            }

    except Exception as e:
        logger.error(f"Error setting up watchlist media listener: {str(e)}")


def get_cached_followed_media(user_id):
    """Gets followed media from cache or set up listener if not available"""
    listener_key = f"followed_{user_id}"
    initial_data_event = threading.Event()

    logger.info(f"Setting up followed media listener for {user_id}")
    followed_ref = users_ref.document(user_id).collection("followed_media")

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                if user_id not in followed_media_cache:
                    followed_media_cache[user_id] = {}

                if not changes:
                    followed_dict = {}
                    for doc in query_snapshot:
                        data = doc.to_dict()
                        media_key = f"{data.get('media_type')}_{data.get('media_id')}"
                        followed_dict[media_key] = {"id": doc.id, **data}
                    followed_media_cache[user_id] = followed_dict
                else:
                    for change in changes:
                        data = change.document.to_dict()
                        media_key = f"{data.get('media_type')}_{data.get('media_id')}"

                        if (
                            change.type.name == "ADDED"
                            or change.type.name == "MODIFIED"
                        ):
                            followed_media_cache[user_id][media_key] = {
                                "id": change.document.id,
                                **data,
                            }
                        elif change.type.name == "REMOVED":
                            if media_key in followed_media_cache[user_id]:
                                del followed_media_cache[user_id][media_key]

                logger.info(f"Followed media cache updated for {user_id}")

            with listener_lock:
                if listener_key in active_listeners:
                    active_listeners[listener_key]["last_active"] = time.time()
        except Exception as e:
            logger.error(f"Error in followed media snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    with listener_lock:
        if user_id in followed_media_cache and listener_key in active_listeners:
            info = active_listeners.get(listener_key)
            if info:
                info["last_active"] = time.time()
            return followed_media_cache.get(user_id, {})
        if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
            msg = f"{listener_key} cap reached ({MAX_ACTIVE_LISTENERS})"
            logger.error(msg)
            raise RuntimeError(msg)
        if listener_key in active_listeners:
            active_listeners[listener_key]["last_active"] = time.time()
            return followed_media_cache.get(user_id, {})
        listener = followed_ref.on_snapshot(on_snapshot)
        active_listeners[f"followed_{user_id}"] = {
            "listener": listener,
            "last_active": time.time(),
        }

    initial_data_event.wait(timeout=5.0)
    return followed_media_cache.get(user_id, {})


def get_cached_tv_progress(user_id):
    """Gets TV progress from cache or set up listener if not available"""
    listener_key = f"tv_progress_{user_id}"
    initial_data_event = threading.Event()
    logger.info(f"Setting up TV progress listener for {user_id}")
    progress_ref = users_ref.document(user_id).collection("tv_progress")

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                if not changes:
                    progress_dict = {}
                    for doc in query_snapshot:
                        data = doc.to_dict()
                        tv_id = data.get("tv_id")
                        progress_dict[f"tv_{tv_id}"] = data
                    tv_progress_cache[user_id] = progress_dict
                else:
                    if user_id not in tv_progress_cache:
                        tv_progress_cache[user_id] = {}

                    for change in changes:
                        data = change.document.to_dict()
                        tv_id = data.get("tv_id")

                        if (
                            change.type.name == "ADDED"
                            or change.type.name == "MODIFIED"
                        ):
                            tv_progress_cache[user_id][f"tv_{tv_id}"] = data
                        elif change.type.name == "REMOVED":
                            tv_key = f"tv_{tv_id}"
                            if tv_key in tv_progress_cache[user_id]:
                                del tv_progress_cache[user_id][tv_key]

                logger.info(f"TV progress cache updated for {user_id}")

            with listener_lock:
                if listener_key in active_listeners:
                    active_listeners[listener_key]["last_active"] = time.time()
        except Exception as e:
            logger.error(f"Error in TV progress snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    with listener_lock:
        if user_id in tv_progress_cache and listener_key in active_listeners:
            info = active_listeners.get(listener_key)
            if info:
                info["last_active"] = time.time()
            return tv_progress_cache.get(user_id, {})
        if len(active_listeners) >= MAX_ACTIVE_LISTENERS:
            msg = f"{listener_key} cap reached ({MAX_ACTIVE_LISTENERS})"
            logger.error(msg)
            raise RuntimeError(msg)
        if listener_key in active_listeners:
            active_listeners[listener_key]["last_active"] = time.time()
            return tv_progress_cache.get(user_id, {})
        listener = progress_ref.on_snapshot(on_snapshot)
        active_listeners[f"tv_progress_{user_id}"] = {
            "listener": listener,
            "last_active": time.time(),
        }

    initial_data_event.wait(timeout=5.0)
    return tv_progress_cache.get(user_id, {})


def start_all_listeners_for_user(user_id):
    """Initializes all listeners for a specific user"""
    global listener_thread
    try:
        if len(active_listeners) > MAX_ACTIVE_LISTENERS * 0.8:  # 80% threshold
            logger.warning(
                f"Approaching listener limit ({len(active_listeners)}/{MAX_ACTIVE_LISTENERS})"
            )
            cleanup_stale_listeners()

        get_cached_user_data(user_id)
        get_cached_user_ratings(user_id)
        get_cached_user_comments(user_id)
        get_cached_user_watchlists(user_id)
        get_cached_followed_media(user_id)
        get_cached_tv_progress(user_id)

        # Starts a background thread to keep listeners alive if not already running
        with listener_lock:
            if listener_thread is None or not listener_thread.is_alive():
                listener_shutdown_event.clear()
                listener_thread = threading.Thread(target=keep_listeners_alive)
                listener_thread.daemon = True
                listener_thread.start()
                logger.info("Started listener maintenance thread")

        return {"status": "success", "message": "All listeners initialized"}
    except Exception as e:
        logger.error(f"Error starting listeners: {str(e)}")
        return {"status": "error", "message": str(e)}


def detach_listener(listener_key):
    """Detaches a specific listener by key"""
    info = None
    with cache_lock:
        with listener_lock:
            info = active_listeners.pop(listener_key, None)
            if not info:
                return False

            for prefix, cache_dict in EVICTION_MAP.items():
                if listener_key.startswith(prefix):
                    user_id = listener_key[len(prefix) :]
                    cache_dict.pop(user_id, None)
                    break
            else:
                # special-case for watchlist_media_
                if listener_key.startswith("watchlist_media_"):
                    _, _, rest = listener_key.partition("watchlist_media_")
                    user_id, _, wl_id = rest.partition("_")
                    for wl in watchlist_cache.get(user_id, []):
                        if wl["id"] == wl_id:
                            wl.pop("media", None)
                            break

    try:
        info["listener"].unsubscribe()
        logger.info(f"Detached listener: {listener_key}")
    except Exception as e:
        logger.error(f"Error detaching listener {listener_key}: {e}")
    return True


def keep_listeners_alive():
    HEALTH_INTERVAL = 120
    SLEEP_CHUNK = 1
    last_check = time.time()

    logger.info("Listener maintenance thread started")
    while not listener_shutdown_event.is_set():
        now = time.time()
        if now - last_check >= HEALTH_INTERVAL:
            _perform_health_check()
            last_check = now

        # Sleep in small chunks to react quickly to shutdown
        if listener_shutdown_event.wait(timeout=SLEEP_CHUNK):
            break


def _perform_health_check():
    LISTENER_TIMEOUT = 300
    try:
        removed = cleanup_stale_listeners(max_age=LISTENER_TIMEOUT)

        if removed:
            logger.info(f"Cleaned up {removed} stale listeners")
    except Exception as e:
        logger.error(f"Error performing health check: {e}")


def cleanup_stale_listeners(max_age=300):
    """Removes listeners that haven't been active recently"""
    current_time = time.time()
    removed_count = 0

    with listener_lock:
        stale_keys = [
            key
            for key, info in active_listeners.items()
            if current_time - info["last_active"] > max_age
        ]
    for key in stale_keys:
        detach_listener(key)
        removed_count += 1

    if removed_count > 0:
        logger.info(f"Cleaned up {removed_count} stale listeners")
    return removed_count


def shutdown_all_listeners():
    """Shutdown all active listeners"""
    logger.info(f"Shutting down {len(active_listeners)} active listeners")
    listener_shutdown_event.set()
    if listener_thread and listener_thread.is_alive():
        listener_thread.join(timeout=1.0)

    keys_and_infos = list(active_listeners.items())
    active_listeners.clear()

    for key, info in keys_and_infos:
        try:
            info["listener"].unsubscribe()
            logger.info(f"Unsubscribed {key}")
        except Exception as e:
            logger.error(f"Error unsubscribing {key}: {e}")
