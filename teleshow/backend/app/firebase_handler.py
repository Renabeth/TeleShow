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

EVICTION_MAP = {
    "user_": user_cache,
    "ratings_": ratings_cache,
    "comments_": comments_cache,
    "watchlists_": watchlist_cache,
    "followed_": followed_media_cache,
    "tv_progress_": tv_progress_cache,
}

active_listeners = {}
cache_lock = threading.RLock()
listener_lock = threading.RLock()

listener_shutdown_event = threading.Event()
listener_thread = None
_initializing_users = set()
_initializing_lock = threading.Lock()

users_ref = get_db().collection("users-test")


# Utility to register a listener
def _attach_listener(key: str, create_fn):
    if key in active_listeners:
        return

    watch = create_fn()
    active_listeners[key] = {"listener": watch, "restart": create_fn}
    logger.info(f"Attached listener: {key}")


def get_cached_user_data(user_id):
    """Gets user data from cache or set up listener if not available"""
    initial_data_event = threading.Event()
    listener_key = f"user_{user_id}"
    if listener_key in active_listeners:
        logger.info("Cache used for user data")
        return user_cache.get(user_id, {})
    user_ref = users_ref.document(user_id)

    def on_snapshot(doc_snapshot, changes, read_time):
        try:
            with cache_lock:
                for doc in doc_snapshot:
                    user_cache[user_id] = doc.to_dict()
                    logger.info(f"User document cached for {user_id}")
        except Exception as e:
            logger.error(f"Error in user snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    _attach_listener(listener_key, create_fn=lambda: user_ref.on_snapshot(on_snapshot))

    initial_data_event.wait(timeout=5.0)
    return user_cache.get(user_id, {})


def get_cached_user_ratings(user_id):
    """Gets user ratings from cache or set up listener if not available"""
    initial_data_event = threading.Event()
    listener_key = f"ratings_{user_id}"
    if listener_key in active_listeners:
        logger.info("Cache used for ratings data")
        return ratings_cache.get(user_id, {})
    logger.info(f"Setting up ratings listener for {user_id}")
    ratings_ref = get_db().collection("Ratings")
    query = ratings_ref.where(filter=FieldFilter("user_id", "==", user_id))

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                ratings = {
                    f"{d.to_dict()['media_type']}_{d.to_dict()['media_id']}": d.to_dict()
                    for d in query_snapshot
                }
                ratings_cache[user_id] = ratings
                logger.info(f"Ratings cached for {user_id}")
        except Exception as e:
            logger.error(f"Error in ratings snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    _attach_listener(listener_key, create_fn=lambda: query.on_snapshot(on_snapshot))
    initial_data_event.wait(timeout=5.0)
    return ratings_cache.get(user_id, {})


def get_cached_user_comments(user_id):
    """Gets user comments from cache or set up listener if not available"""
    listener_key = f"comments_{user_id}"
    if listener_key in active_listeners:
        logger.info("Cache used for comments data")
        return comments_cache.get(user_id, [])
    initial_data_event = threading.Event()

    logger.info(f"Setting up comments listener for {user_id}")
    comments_ref = get_db().collection("Comments")
    query = comments_ref.where(filter=FieldFilter("user_id", "==", user_id))

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                is_initial = user_id not in comments_cache
                if is_initial:
                    comments_cache[user_id] = [
                        {"id": doc.id, **doc.to_dict()} for doc in query_snapshot
                    ]
                elif changes:
                    for change in changes:
                        data = {"id": change.document.id, **change.document.to_dict()}
                        if change.type.name == "ADDED":
                            comments_cache[user_id].append(data)
                        elif change.type.name == "MODIFIED":
                            # Updates existing comment
                            for i, comment in enumerate(comments_cache[user_id]):
                                if comment["id"] == data["id"]:
                                    comments_cache[user_id][i].update(data)
                                    break
                        elif change.type.name == "REMOVED":
                            # Removes deleted comment
                            comments_cache[user_id] = [
                                c
                                for c in comments_cache[user_id]
                                if c["id"] != data["id"]
                            ]
                else:
                    logger.debug("Empty snapshot after initial load; ignoring.")
                logger.info(f"Comments cached for {user_id}")
        except Exception as e:
            logger.error(f"Error in comments snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    _attach_listener(listener_key, create_fn=lambda: query.on_snapshot(on_snapshot))

    initial_data_event.wait(timeout=5.0)
    return comments_cache.get(user_id, [])


def get_cached_user_watchlists(user_id):
    """Gets user watchlists from cache or set up listener if not available"""
    listener_key = f"watchlists_{user_id}"
    if listener_key in active_listeners:
        logger.info("Cache used for watchlist data")
        return watchlist_cache.get(user_id, [])
    initial_data_event = threading.Event()
    logger.info(f"Setting up watchlists listener for {user_id}")
    watchlist_ref = users_ref.document(user_id).collection("watchlists")

    def on_snapshot(query_snapshot, changes, read_time):

        try:
            with cache_lock:

                is_initial = user_id not in watchlist_cache
                if is_initial:
                    watchlist_cache[user_id] = [
                        {"id": doc.id, **doc.to_dict()} for doc in query_snapshot
                    ]

                    for wl in watchlist_cache[user_id]:
                        key = f"watchlist_media_{user_id}_{wl['id']}"
                        if key not in active_listeners:
                            setup_watchlist_media_listener(user_id, wl["id"])
                elif changes:
                    for change in changes:
                        to_remove, to_add = [], []
                        data = {"id": change.document.id, **change.document.to_dict()}

                        if change.type.name == "ADDED":
                            watchlist_cache[user_id].append(data)
                            to_add.append(data["id"])

                        elif change.type.name == "MODIFIED":
                            for i, wl in enumerate(watchlist_cache[user_id]):
                                if wl["id"] == data["id"]:
                                    watchlist_cache[user_id][i].update(data)
                                    break

                        elif change.type.name == "REMOVED":
                            watchlist_cache[user_id] = [
                                wl
                                for wl in watchlist_cache[user_id]
                                if wl["id"] != data["id"]
                            ]
                            to_remove.append(data["id"])

                    for wl_id in to_remove:
                        media_key = f"watchlist_media_{user_id}_{wl_id}"
                        detach_listener(media_key)
                    for wl_id in to_add:
                        setup_watchlist_media_listener(user_id, wl_id)
                else:
                    logger.debug("Empty snapshot after initial load; ignoring.")

                logger.info(f"Watchlists cached for {user_id}")

        except Exception as e:
            logger.error(f"Error in watchlists snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    _attach_listener(
        listener_key, create_fn=lambda: watchlist_ref.on_snapshot(on_snapshot)
    )
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
                    user_lists = watchlist_cache.get(user_id, [])
                    target_watchlist = next(
                        (wl for wl in user_lists if wl["id"] == watchlist_id), None
                    )

                    if target_watchlist is None:
                        logger.error(
                            f"Watchlist {watchlist_id} not found for user {user_id}"
                        )
                        return
                    is_initial = "media" not in target_watchlist
                    if is_initial:
                        target_watchlist["media"] = [
                            {"id": doc.id, **doc.to_dict()} for doc in query_snapshot
                        ]
                        logger.info(
                            f"Initialized media items for watchlist {watchlist_id}"
                        )
                    elif changes:
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

                    logger.info(f"Media cached for watchlist {watchlist_id}")
            except Exception as e:
                logger.error(f"Error in watchlist media snapshot listener: {str(e)}")

        _attach_listener(
            listener_key, create_fn=lambda: media_ref.on_snapshot(on_snapshot)
        )

    except Exception as e:
        logger.error(f"Error setting up watchlist media listener: {str(e)}")


def get_cached_followed_media(user_id):
    """Gets followed media from cache or set up listener if not available"""
    listener_key = f"followed_{user_id}"
    if listener_key in active_listeners:
        logger.info("Cache used for followed media")
        return followed_media_cache.get(user_id, {})
    initial_data_event = threading.Event()

    logger.info(f"Setting up followed media listener for {user_id}")
    followed_ref = users_ref.document(user_id).collection("followed_media")

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                is_initial = user_id not in followed_media_cache
                if is_initial:
                    followed_media_cache[user_id] = {
                        f"{d.to_dict().get('media_type')}_{d.to_dict().get('media_id')}": {
                            "id": d.id,
                            **d.to_dict(),
                        }
                        for d in query_snapshot
                    }
                elif changes:
                    for change in changes:
                        data = change.document.to_dict()
                        media_key = f"{data.get('media_type')}_{data.get('media_id')}"
                        if change.type.name == "ADDED":
                            followed_media_cache[user_id][media_key] = {
                                "id": change.document.id,
                                **data,
                            }
                        elif change.type.name == "MODIFIED":
                            if media_key in followed_media_cache:
                                followed_media_cache[user_id][media_key].update(data)
                            else:
                                followed_media_cache[user_id][media_key] = {
                                    "id": change.document.id,
                                    **data,
                                }
                        elif change.type.name == "REMOVED":
                            followed_media_cache[user_id].pop(media_key, None)
                else:
                    logger.debug("Empty snapshot after initial load; ignoring.")

                logger.info(f"Followed media cached for {user_id}")
        except Exception as e:
            logger.error(f"Error in followed media snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    _attach_listener(
        listener_key, create_fn=lambda: followed_ref.on_snapshot(on_snapshot)
    )

    initial_data_event.wait(timeout=5.0)
    return followed_media_cache.get(user_id, {})


def get_cached_tv_progress(user_id):
    """Gets TV progress from cache or set up listener if not available"""
    listener_key = f"tv_progress_{user_id}"
    if listener_key in active_listeners:
        logger.info("Cache used for tv progress")
        return tv_progress_cache.get(user_id, {})
    initial_data_event = threading.Event()
    logger.info(f"Setting up TV progress listener for {user_id}")
    progress_ref = users_ref.document(user_id).collection("tv_progress")

    def on_snapshot(query_snapshot, changes, read_time):
        try:
            with cache_lock:
                is_initial = user_id not in tv_progress_cache
                if is_initial:
                    tv_progress_cache[user_id] = {
                        f"tv_{d.to_dict().get('tv_id')}": d.to_dict()
                        for d in query_snapshot
                    }
                elif changes:
                    for change in changes:
                        data = change.document.to_dict()
                        key = f"tv_{data.get('tv_id')}"

                        if change.type.name == "ADDED":
                            tv_progress_cache[user_id][key] = {
                                "id": change.document.id,
                                **data,
                            }
                        elif change.type.name == "MODIFIED":
                            # Merge only the changed fields into the existing dict
                            if key in tv_progress_cache[user_id]:
                                tv_progress_cache[user_id][key].update(data)
                            else:
                                # Fallback if we somehow missed the add
                                tv_progress_cache[user_id][key] = {
                                    "id": change.document.id,
                                    **data,
                                }
                        elif change.type.name == "REMOVED":
                            tv_progress_cache[user_id].pop(key, None)
                else:
                    logger.debug("Empty snapshot after initial load; ignoring.")

                logger.info(f"TV progress cached for {user_id}")
        except Exception as e:
            logger.error(f"Error in TV progress snapshot listener: {str(e)}")
        finally:
            initial_data_event.set()

    _attach_listener(
        listener_key, create_fn=lambda: progress_ref.on_snapshot(on_snapshot)
    )
    initial_data_event.wait(timeout=5.0)
    return tv_progress_cache.get(user_id, {})


def start_all_listeners_for_user(user_id):
    """Initializes all listeners for a specific user"""
    global listener_thread
    with _initializing_lock:
        if user_id in _initializing_users:
            logger.info(f"Initialization already in progress for {user_id}, skipping")
            return {
                "status": "in_progress",
                "message": "Initialization already in progress",
            }
        _initializing_users.add(user_id)
    try:
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
                listener_thread = threading.Thread(target=monitor_listeners)
                listener_thread.daemon = True
                listener_thread.start()
                logger.info("Started listener maintenance thread")

        return {"status": "success", "message": "All listeners initialized"}
    except Exception as e:
        logger.error(f"Error starting listeners: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        with _initializing_lock:
            _initializing_users.remove(user_id)


def detach_listener(listener_key):
    """Detaches a specific listener by key"""
    with listener_lock:
        info = active_listeners.pop(listener_key, None)
    if not info:
        return False

    try:
        info["listener"].unsubscribe()
        logger.info(f"Detached listener: {listener_key}")
    except Exception as e:
        logger.error(f"Error detaching {listener_key}: {e}")
    return True


def monitor_listeners(interval=300):
    # Background thread: every `interval` seconds, restart any closed listener.
    try:
        while not listener_shutdown_event.is_set():
            time.sleep(interval)
            with listener_lock:
                for key, info in list(active_listeners.items()):
                    watch = info["listener"]
                    # Firestore Watch has an internal ._closed flag when stream ends
                    if getattr(watch, "_closed", False):
                        logger.warning(f"{key} closed unexpectedly; restarting")
                        try:
                            watch.unsubscribe()
                        except:
                            pass
                        # Re-creates listener
                        new_watch = info["restart"]()
                        active_listeners[key]["listener"] = new_watch
                        logger.info(f"Restarted listener: {key}")
    except Exception as e:
        logger.error(f"Error monitoring listeners: {e}")


def shutdown_all_listeners():
    """Shutdown all active listeners"""
    logger.info(f"Shutting down {len(active_listeners)} active listeners")
    listener_shutdown_event.set()
    if listener_thread and listener_thread.is_alive():
        try:
            listener_thread.join(timeout=1.0)
        except Exception as e:
            logger.error(f"Error joining listener thread: {e}")

    try:
        with cache_lock:
            user_cache.clear()
            ratings_cache.clear()
            comments_cache.clear()
            followed_media_cache.clear()
            watchlist_cache.clear()
            tv_progress_cache.clear()
        logger.info("All caches cleared")
    except Exception as e:
        logger.error(f"Error clearing caches: {e}")
    with listener_lock:
        for key, info in list(active_listeners.items()):
            try:
                info["listener"].unsubscribe()
                logger.info(f"Unsubscribed {key}")
            except Exception as e:
                logger.error(f"Error unsubscribing {key}: {e}")

    active_listeners.clear()
