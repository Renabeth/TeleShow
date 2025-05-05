# Written by Moses Pierre
# This file is meant to house firebase interaction viewfunctions
from flask import Blueprint, request, jsonify
import tmdbsimple as tmdb  # Library that makes interacting with TMDB API simplier
from firebase_admin import firestore
import datetime
import time
from app.extensions import cache, get_db, limiter
from app.firebase_handler import (
    get_cached_user_ratings,
    get_cached_user_watchlists,
    get_cached_followed_media,
    get_cached_user_comments,
    get_cached_tv_progress,
    start_all_listeners_for_user,
    shutdown_all_listeners,
)
from google.cloud.firestore_v1.base_query import FieldFilter

interactions_bp = Blueprint("interactions", __name__)
users_ref = get_db().collection("users-test")


# HELPER FUNCTION FOR ADDING TO WATCHLIST IN FIRESTORE
def add_to_watchlist(user_id, watchlist_name, media_info):
    user = users_ref.document(user_id).get()
    user_ref = users_ref.document(user_id)

    if not user.exists:
        print(f"User with ID {user_id} does not exist.")
        return None

    # Go to the watchlists subcollection of users
    watchlist_ref = user_ref.collection("watchlists")
    # Look for the watchlist document that matches the key
    watchlist_query = watchlist_ref.where(
        filter=FieldFilter("name", "==", watchlist_name)
    ).limit(1)
    # Get the results
    watchlist_docs = list(watchlist_query.stream())

    batch = get_db().batch()

    if watchlist_docs:
        # Set the doc to the first result
        # If watchlist exists get reference
        watchlist_doc_ref = watchlist_docs[0].reference
        batch.update(watchlist_doc_ref, {"updated_at": firestore.SERVER_TIMESTAMP})
    else:
        # If it doesn't create a new document
        watchlist_doc_ref = watchlist_ref.document()
        batch.set(
            watchlist_doc_ref,
            {
                "name": watchlist_name,
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )
        print(f"Created new watchlist '{watchlist_name}'")

    # Check if the media already exists in the watchlist
    media_id = media_info.get("id")
    media_check = (
        watchlist_doc_ref.collection("media")
        .where(filter=FieldFilter("media_id", "==", media_id))
        .limit(1)
        .get()
    )

    if len(media_check) > 0:
        return {"error": "Media already exists in watchlist"}

    # Media added to watchlist media subcollection
    media_ref = watchlist_doc_ref.collection("media").document()

    batch.set(
        media_ref,
        {
            "title": media_info.get("media_name"),
            "media_id": media_info.get("id"),
            "overview": media_info.get("overview"),
            "release_date": media_info.get("release_date"),
            "media_type": media_info.get("media_type"),
            "poster_path": media_info.get("poster_path"),
            "added_at": firestore.SERVER_TIMESTAMP,
            "status": "Plan to watch",
        },
    )

    batch.commit()

    return {"watchlist_id": watchlist_doc_ref.id, "media_id": media_ref.id}


# HELPER FUNCTION FOR UPDATING USER INTERESTS IN FIRESTORE
def update_user_interests(user_ref, genres, keywords, production_companies, action):
    if user_ref:
        # Points to interest subcollection of users
        interests_collection = user_ref.collection("interests")
        # Points to genres and keywords documents
        genres_doc_ref = interests_collection.document("genres")
        keywords_doc_ref = interests_collection.document("keywords")
        companies_doc_ref = interests_collection.document("production_companies")

        # Allows for sending all requestion at once using the firebase sdk
        batch = get_db().batch()

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
            batch.set(
                genres_doc_ref,
                {"items": updated_genres, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
            batch.set(
                keywords_doc_ref,
                {"items": updated_keywords, "lastUpdated": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
            batch.set(
                companies_doc_ref,
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

            batch.set(
                genres_doc_ref,
                {"items": updated_genres, "lastUpdated": firestore.SERVER_TIMESTAMP},
            )
            batch.set(
                keywords_doc_ref,
                {"items": updated_keywords, "lastUpdated": firestore.SERVER_TIMESTAMP},
            )
            batch.set(
                companies_doc_ref,
                {"items": updated_companies, "lastUpdated": firestore.SERVER_TIMESTAMP},
            )

        batch.commit()


@interactions_bp.route("/initialize-listeners", methods=["POST"])
def initialize_user_listeners():
    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "User ID is required"})

    result = start_all_listeners_for_user(user_id)
    return jsonify(result)


@interactions_bp.route("/stop-listeners", methods=["POST"])
def stop_user_listeners():
    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "User ID is required"})

    shutdown_all_listeners()
    return jsonify({"status": "success"})


# GET EPISODE PROGRESS AND SHOW WHICH EPISODES HAVE BEEN WATCHED
# This gets the information from firebase while another function sets it
# The interactions/episode-progress sets the progress information
@interactions_bp.route("/tv/get-episode-progress", methods=["GET"])
def get_episode_progress():
    user_id = request.args.get("user_id")
    tv_id = request.args.get("tv_id")

    if not user_id or not tv_id:
        return jsonify({"error": "user ID and TV ID are required"})

    try:
        all_progress = get_cached_tv_progress(user_id)
        tv_progress_key = f"tv_{tv_id}"

        if tv_progress_key not in all_progress:
            return jsonify(
                {"progress": {}, "message": "No progress found for this show"}
            )

        progress_data = all_progress[tv_progress_key]
        return jsonify({"progress": progress_data})

    except Exception as e:
        print(f"Error getting episode progress: {str(e)}")
        return jsonify({"error": f"Failed to get episode progress: {str(e)}"})


# FOR UPDATING EPISODE PROGRESS FROM FIRESTORE FOR USER
# This is the method that sets episode progress when user sets episode as watched
@interactions_bp.route("/tv/set-episode-progress", methods=["POST"])
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


# GET CALENDAR ENTRIES
@interactions_bp.route("/media/calendar", methods=["GET"])
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
        tv_calendar_docs = calendar_ref.stream()

        # For backwards compatibility im making a new movie calendar collection
        movie_calendar_ref = user_ref.collection("movie_calendar")
        movie_calendar_docs = movie_calendar_ref.stream()

        calendar_entries = []
        for doc in tv_calendar_docs:
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
                            "media_type": "tv",
                            "media_id": data.get("media_id"),
                            "poster_path": data.get("poster_path"),
                            "season": data["next_episode"].get("season"),
                            "episode": data["next_episode"].get("episode"),
                            "episode_name": data["next_episode"].get("name"),
                            "air_date": air_date,
                            "overview": data["next_episode"].get("overview"),
                        }
                    )
        for doc in movie_calendar_docs:
            data = doc.to_dict()
            if data.get("release_date"):
                release_date = data["release_date"]
                today = datetime.datetime.now().strftime("%Y-%m-%d")

                if release_date >= today:
                    calendar_entries.append(
                        {
                            "id": doc.id,
                            "media_type": "movie",
                            "title": data.get("title"),
                            "media_id": data.get("media_id"),
                            "poster_path": data.get("poster_path"),
                            "release_date": release_date,
                            "overview": data.get("overview"),
                        }
                    )
        # Sort by air date
        calendar_entries.sort(key=lambda x: x.get("air_date", x.get("release_date")))

        return jsonify({"calendar": calendar_entries})
    except Exception as e:
        print(f"Error retrieving TV calendar: {str(e)}")
        return jsonify({"error": f"Failed to retrieve TV calendar: {str(e)}"})


# UPDATE CALENDAR ENTRIES
# Updates the calendar from collection information
@interactions_bp.route("/media/update-calendar", methods=["POST"])
@limiter.limit("50 per 10 seconds")
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
        followed_tv_ref = user_ref.collection("followed_media")
        tv_shows = followed_tv_ref.where(
            filter=FieldFilter("media_type", "==", "tv")
        ).stream()

        followed_movies_ref = user_ref.collection("followed_media")
        movies = followed_movies_ref.where(
            filter=FieldFilter("media_type", "==", "movie")
        ).stream()

        updated_count = 0
        for show in tv_shows:
            time.sleep(0.2)  # Pause to avoid rate limiting
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
                            "media_id": media_id,
                            "title": show_data.get("title"),
                            "poster_path": tv_info.get("poster_path"),
                            "next_episode": {
                                "season": next_episode.get("season_number"),
                                "episode": next_episode.get("episode_number"),
                                "name": next_episode.get("name"),
                                "air_date": next_episode.get("air_date"),
                                "overview": next_episode.get("overview"),
                            },
                            "media_type": "tv",
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

        for movie in movies:
            time.sleep(0.2)  # Pause to avoid rate limiting
            movie_data = movie.to_dict()
            media_id = movie_data.get("media_id")

            movie_api = tmdb.Movies(media_id)
            movie_info = movie_api.info()

            # Check if the movie has a future release date
            if movie_info.get("release_date"):
                release_date = movie_info.get("release_date")
                today = datetime.datetime.now().strftime("%Y-%m-%d")

                if release_date >= today:
                    # Add to movie calendar
                    calendar_ref = user_ref.collection("movie_calendar")
                    calendar_ref.document(f"movie_{media_id}").set(
                        {
                            "media_id": media_id,
                            "title": movie_data.get("title"),
                            "poster_path": movie_info.get("poster_path"),
                            "media_type": "movie",
                            "release_date": release_date,
                            "overview": movie_info.get("overview"),
                            "media_type": "movie",
                            "last_updated": firestore.SERVER_TIMESTAMP,
                        }
                    )
                    updated_count += 1
                else:
                    # Remove from calendar if already released
                    calendar_ref = user_ref.collection("movie_calendar")
                    calendar_doc = calendar_ref.document(f"movie_{media_id}")
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


# FOR Following MEDIA IN SEARCH
# Also adds show to calendar if valid
@interactions_bp.route("/media_follow", methods=["POST"])
def handle_media_follow():
    data = request.get_json()
    user_id = data.get("user_id")
    media_id = data.get("media_id")
    media_type = data.get("media_type")
    title = data.get("title")
    release_date = data.get("release_date")
    poster_path = data.get("poster_path")
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
                "poster_path": poster_path,
                "release_date": release_date,
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
@interactions_bp.route("/check_followed", methods=["GET"])
def check_if_media_followed():
    user_id = request.args.get("user_id")
    media_id = request.args.get("media_id")
    media_type = request.args.get("media_type")

    if not user_id or not media_id or not media_type:
        return jsonify({"error": "User ID, Media ID, and Media Type are required"})

    followed_media = get_cached_followed_media(user_id)

    media_key = f"{media_type}_{media_id}"
    followed = media_key in followed_media

    return jsonify({"followed": followed})


# Getting the media in the followed collection
@interactions_bp.route("/get_followed", methods=["GET"])
def get_followed_media():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "User must be logged in"})

    followed_media = get_cached_followed_media(user_id)
    user_tv = []
    user_movies = []

    for key, media in followed_media.items():
        if media.get("media_type") == "tv":
            user_tv.append(media)
        elif media.get("media_type") == "movie":
            user_movies.append(media)

    return jsonify({"followed_tv": user_tv, "followed_movies": user_movies})


# FOR ADDING TO WATCHLIST
@interactions_bp.route("/add-watchlist", methods=["POST"])
def add_media_to_watchlist():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_name = data.get("watchlist_name")
    media_info = data.get("media_info")

    if not user_id or not watchlist_name or not media_info:
        return jsonify({"error": "Missing required parameters"})

    result = add_to_watchlist(user_id, watchlist_name, media_info)
    if "error" in result:
        return jsonify({"error": result["error"]})
    elif result:
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
@interactions_bp.route("/get-watchlists", methods=["GET"])
def get_user_watchlists():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "User login required"})

    watchlists_data = get_cached_user_watchlists(user_id)

    watchlists = []

    for watchlist in watchlists_data:
        watchlists.append(
            {
                "id": watchlist["id"],  # Actual document id
                "name": watchlist.get("name"),
                "created_at": watchlist.get("created_at"),
                "updated_at": watchlist.get("updated_at"),
            }
        )

    return jsonify({"watchlists": watchlists})


# FOR GETTING WATCHLIST MEDIA FOR ONE WATCHLIST
@interactions_bp.route("/get-watchlist-media", methods=["GET"])
def get_watchlist_media():
    user_id = request.args.get("user_id")
    watchlist_id = request.args.get("watchlist_id")

    if not user_id or not watchlist_id:
        return jsonify({"error": "User ID and Watchlist ID are required"})

    watchlists = get_cached_user_watchlists(user_id)

    target_watchlist = None
    for wl in watchlists:
        if wl["id"] == watchlist_id:
            target_watchlist = wl
            break

    if not target_watchlist:
        return jsonify({"error": "Watchlist not found"})

    watchlist_name = target_watchlist.get("name", "Unknown")

    media_items = []
    if "media" in target_watchlist:  # Each doc is a movie or tv show within a watchlist
        for item in target_watchlist["media"]:
            media_items.append(
                {
                    "id": item["id"],
                    "media_id": item.get("media_id"),
                    "media_type": item.get("media_type"),
                    "title": item.get("title"),
                    "overview": item.get("overview"),
                    "release_date": item.get("release_date"),
                    "poster_path": item.get("poster_path"),
                    "added_at": item.get("added_at"),
                    "status": item.get("status", "Plan to watch"),
                    "watchlist_id": watchlist_id,
                    "watchlist_name": watchlist_name,
                }
            )

    return jsonify({"media": media_items})


# FOR GETTING WATCHLIST MEDIA FOR MULTIPLE WATCHLISTS
@interactions_bp.route("/get-multiple-watchlist-media", methods=["POST"])
def get_multiple_watchlist_media():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_ids = data.get("watchlist_ids", [])

    if not user_id or not watchlist_ids:
        return jsonify({"error": "User ID and Watchlist IDs are required"})

    all_watchlists = get_cached_user_watchlists(user_id)

    all_media = []

    # Process each watchlist
    for watchlist in all_watchlists:
        if watchlist["id"] in watchlist_ids:
            watchlist_name = watchlist.get("name", "Unknown")

        # Get all media in this watchlist
        if "media" in watchlist:
            for item in watchlist["media"]:
                all_media.append(
                    {
                        "id": item["id"],
                        "media_id": item.get("media_id"),
                        "media_type": item.get("media_type"),
                        "title": item.get("title"),
                        "overview": item.get("overview"),
                        "release_date": item.get("release_date"),
                        "poster_path": item.get("poster_path"),
                        "added_at": item.get("added_at"),
                        "status": item.get("status", "Plan to watch"),
                        "watchlist_id": watchlist["id"],
                        "watchlist_name": watchlist_name,
                    }
                )

    return jsonify({"media": all_media})


# FOR REMOVING MEDIA FROM WATCHLIST
@interactions_bp.route("/remove-from-watchlist", methods=["POST"])
def remove_from_watchlist():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_id = data.get("watchlist_id")
    media_id = data.get("media_id")

    if not user_id or not watchlist_id or not media_id:
        return jsonify({"error": "Requirements not meet for operation"})

    try:
        batch = get_db().batch()
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
        if not watchlist_ref.get().exists:
            return jsonify({"error": "Watchlist not found"})

        media_query = watchlist_ref.collection("media").where(
            filter=FieldFilter("media_id", "==", media_id)
        )
        media_docs = media_query.get()

        if len(list(media_docs)) == 0:
            return jsonify({"error": "Media not found in watchlist"})

        for doc in media_docs:
            batch.delete(doc.reference)

        batch.update(watchlist_ref, {"updated_at": firestore.SERVER_TIMESTAMP})
        batch.commit()

        return jsonify({"status": "success", "message": "Media removed from watchlist"})
    except Exception as e:
        print(f"Error removing media from watchlist: {str(e)}")
        return jsonify({"error": f"Failed to remove media from watchlist: {str(e)}"})


# FOR DELETING ENTIRE WATCHLIST
@interactions_bp.route("/delete-watchlist", methods=["POST"])
def delete_watchlist():
    data = request.get_json()
    user_id = data.get("user_id")
    watchlist_id = data.get("watchlist_id")

    if not user_id or not watchlist_id:
        return jsonify({"error": "Requirements not meet for operation"})
    try:  # Going down the line deleting
        batch = get_db().batch()
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})
        watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
        if not watchlist_ref.get().exists:
            return jsonify({"error": "Watchlist not found"})
        # Start by deleting the media subcollection
        media_docs = watchlist_ref.collection("media").stream()
        for doc in media_docs:
            batch.delete(doc.reference)
        # Then I delete the watchlist
        batch.delete(watchlist_ref)
        batch.commit()
        return jsonify(
            {"status": "success", "message": "Watchlist deleted successfully"}
        )
    except Exception as e:
        print(f"Error deleting watchlist: {str(e)}")
        return jsonify({"error": f"Failed to delete watchlist: {str(e)}"})


# FOR GETTING MEDIA STATUS IN WATCHLIST
@interactions_bp.route("/update-media-status", methods=["POST"])
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
        batch = get_db().batch()
        user_ref = users_ref.document(user_id)
        if not user_ref.get().exists:
            return jsonify({"error": "User not found"})

        watchlist_ref = user_ref.collection("watchlists").document(watchlist_id)
        if not watchlist_ref.get().exists:
            return jsonify({"error": "watchlist not found"})

        media_query = watchlist_ref.collection("media").where(
            filter=FieldFilter("media_id", "==", media_id)
        )
        media_docs = media_query.get()

        # Check if the media is in the media subcollection
        if len(list(media_docs)) == 0:
            return jsonify({"error": "Media not found in watchlist"})

        for doc in media_docs:
            batch.update(doc.reference, {"status": status})

        batch.update(watchlist_ref, {"updated_at": firestore.SERVER_TIMESTAMP})
        batch.commit()

        return jsonify(
            {"status": "success", "message": "Media status updated successfully"}
        )

    except Exception as e:
        print(f"Error updating media status: {str(e)}")
        return jsonify({"error": f"Failed to update media status: {str(e)}"})


@interactions_bp.route("/get-ratings", methods=["GET"])
def get_ratings():
    user_id = request.args.get("user_id")
    media_id = int(request.args.get("media_id"))
    media_type = request.args.get("media_type")

    if not user_id:
        return jsonify({"error": "UserID required"})

    # Get cached ratings
    ratings = get_cached_user_ratings(user_id)

    # Check for this specific media rating
    media_key = f"{media_type}_{media_id}"
    if media_key in ratings:
        return jsonify(
            {
                "rating": ratings[media_key].get("rating"),
                "message": "Successfully found rating",
            }
        )

    return jsonify({"rating": 0, "message": "No rating found for this media"})


# Gets mutiple ratings at the same time
@interactions_bp.route("/get-multiple-ratings", methods=["POST"])
def get_multiple_ratings():
    data = request.get_json()
    user_id = data.get("user_id")
    media_items = data.get("media_items", [])  # List instead of one by one

    if not user_id or not media_items:
        return jsonify({"error": "User ID and media items are required"})

    try:
        all_ratings = get_cached_user_ratings(user_id)
        results = {}

        for item in media_items:
            media_id = int(item.get("media_id"))
            media_type = item.get("media_type")

            media_key = f"{media_type}_{media_id}"
            if media_key in all_ratings:
                results[media_key] = all_ratings[media_key].get("rating")
            else:
                results[media_key] = 0

        return jsonify(
            {"ratings": results, "message": "Successfully retrieved ratings"}
        )

    except Exception as e:
        print(f"Error getting multiple ratings: {str(e)}")
        return jsonify({"error": f"Failed to get ratings: {str(e)}"})


@cache.cached(query_string=True, timeout=600)
@interactions_bp.route("/user-stats", methods=["GET"])
def get_user_stats():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "User ID required"})

    ratings = list(get_cached_user_ratings(user_id).values())
    comments = get_cached_user_comments(user_id)
    followed = list(get_cached_followed_media(user_id).values())
    watchlists = get_cached_user_watchlists(user_id)
    tv_progress = get_cached_tv_progress(user_id)

    # Collection of media interaction information
    stats = {}
    stats["total_comments"] = len(comments)
    stats["total_ratings"] = len(ratings)
    stats["avg_rating"] = (
        sum(r.get("rating", 0) for r in ratings) / len(ratings) if ratings else 0
    )
    stats["followed_count"] = len(followed)
    stats["watchlist_count"] = len(watchlists)

    movie_count = 0
    tv_count = 0
    for media in followed:
        if media.get("media_type") == "movie":
            movie_count += 1
        elif media.get("media_type") == "tv":
            tv_count += 1

    stats["movie_count"] = movie_count
    stats["tv_count"] = tv_count

    total_seasons = 0
    total_episodes = 0

    for tv_key, show_data in tv_progress.items():
        for season_key, season_data in show_data.get("seasons", {}).items():
            episodes = season_data.get("episodes", {})
            # Check if all episodes in this season are watched
            if episodes and all(ep.get("watched", False) for ep in episodes.values()):
                total_seasons += 1

            # Count watched episodes
            for episode_key, episode_data in episodes.items():
                if episode_data.get("watched") == True:
                    total_episodes += 1

    stats["total_seasons_watched"] = total_seasons
    stats["episodes_watched"] = total_episodes
    # I estimate about 40 minutes per episode
    stats["watch_time_hours"] = round((total_episodes * 40) / 60, 1)
    # Calculating genre distribution
    genre_counts = {}
    for media in followed:
        for genre in media.get("genres", []):
            genre_name = genre.get("name")
            if genre_name:
                if genre_name not in genre_counts:
                    genre_counts[genre_name] = 0
                genre_counts[genre_name] += 1

    stats["top_genres"] = sorted(
        [{"name": k, "count": v} for k, v in genre_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:5]

    return jsonify({"stats": stats})
