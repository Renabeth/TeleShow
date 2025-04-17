//Written by Moses Pierre
//Takes some original functions from searchpage and exports them for use across the project
import axios from "axios";
import LZString from "lz-string";
//Sets the localStorage variables TTL to 24hours
const SEARCH_TTL = 12 * 60 * 60 * 1000;
const host = process.env.REACT_APP_NETWORK_HOST;

export const hashObject = (obj) => {
  //For caching POST requests
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export const getDetails = async (id, type) => {
  console.log("Fetching details for:", id, type);
  const DETAILS_CACHE_KEY = (id, type) => `details-${type}-${id}`;
  const cacheKey = DETAILS_CACHE_KEY(id, type);
  const cache = localStorage.getItem(cacheKey);

  if (cache) {
    const { compressed, data, timestamp } = JSON.parse(cache);
    if (Date.now() - timestamp < SEARCH_TTL) {
      const decompressed = compressed
        ? JSON.parse(LZString.decompress(data))
        : JSON.parse(data);
      console.log("Cache hit for details:", decompressed);
      return decompressed; // Cached data needs to be passed so recommendation handler still runs
    } else {
      localStorage.removeItem(cacheKey);
    }
  }

  try {
    // Makes request to Flask API details endpoint with item ID and media type
    const response = await axios.get(`${host}search/details`, {
      params: { id, type },
    });

    console.log("API response for details:", response.data); //Debugging
    if (response.data.tmdb && response.data.watchmode && response.data.cast) {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );
    }

    return response.data || []; // Store detailed item information
  } catch (error) {
    console.error("error fetching details: ", error);
  }
};

//Recommendation Handling
export const getRecommendations = async (item) => {
  console.log(
    //Debugging
    "Fetching recommendations for:",
    item.tmdb.id,
    item.tmdb.media_type
  );
  const genre_ids = item.tmdb.genres?.map((genre) => genre.id).join(",");
  const producer_ids =
    item.tmdb.production_companies?.map((company) => company.id).join(",") ||
    [];
  const keyword_ids =
    item.tmdb.keywords?.map((keyword) => keyword.id).join(",") || [];

  const payload = {
    //Recommendation factors passed
    id: item.tmdb.id,
    title: item.tmdb.title || item.tmdb.name,
    type: item.tmdb.media_type,
    overview: item.tmdb.overview,
    language: item.tmdb.original_language,
    vote_average: item.tmdb.vote_average,
    release_year:
      item.tmdb.release_date?.split("-")[0] ||
      item.tmdb.first_air_date?.split("-")[0],
    genre_ids,
    producer_ids,
    keyword_ids,
  };

  const payloadHash = hashObject(payload);

  const REC_CACHE_KEY = (id, type, hash) =>
    `recommendations-${type}-${id}-${hash}`;
  const cacheKey = REC_CACHE_KEY(
    item.tmdb.id,
    item.tmdb.media_type,
    payloadHash
  );
  const cache = localStorage.getItem(cacheKey);
  console.log("Generated cacheKey:", cacheKey);

  if (cache) {
    const { compressed, data, timestamp } = JSON.parse(cache);
    if (Date.now() - timestamp < SEARCH_TTL) {
      const decompressed = compressed
        ? JSON.parse(LZString.decompress(data))
        : JSON.parse(data);
      console.log("Cache hit for recommendations");
      return decompressed.recommendations;
    } else {
      localStorage.removeItem(cacheKey);
    }
  }
  try {
    const response = await axios.post(`${host}recommendations`, payload);

    console.log("API response for recommendations");
    if (response.data.recommendations) {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );
    }
    return response.data.recommendations || [];
  } catch (error) {
    console.error("error fetching details: ", error);
  }
};

//Check if the media is follow by user
export const checkIfFollowed = async (mediaId, mediaType) => {
  try {
    const userId = sessionStorage.getItem("userId");
    if (!userId) return;

    const response = await axios.get(`${host}interactions/check_followed`, {
      params: {
        user_id: userId,
        media_id: mediaId,
        media_type: mediaType,
      },
    });
    return response.data.followed; //returns true if found and false if not
  } catch (error) {
    console.error("Error checking media status", error);
  }
};

export const getFollowedMedia = async () => {
  try {
    const userId = sessionStorage.getItem("userId");
    if (!userId) return;

    const response = await axios.get(`${host}interactions/get_followed`, {
      params: {
        user_id: userId,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error getting followed media", error);
  }
};

//Gets the user watchlists from firestore using backend
export const getWatchlists = async () => {
  const userId = sessionStorage.getItem("userId");
  if (!userId) return;

  try {
    const response = await axios.get(
      "http://localhost:5000/interactions/get-watchlists",
      { params: { user_id: userId } }
    );

    return response.data.watchlists || [];
  } catch (error) {
    console.error("Error fetching watchlists:", error);
    return [];
  }
};
