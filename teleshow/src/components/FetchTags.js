import {useState} from "react"
import '../styles/Tags.css'

// Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Help from https://firebase.google.com/docs/firestore/query-data/queries
// And starRate.js
import { 
    query, 
    where, 
    orderBy,
    doc,
    updateDoc
} from "firebase/firestore";

import Button from "react-bootstrap/Button"

// Help from https://react-bootstrap.netlify.app/docs/forms/form-control/
import Form from 'react-bootstrap/Form';

const FetchTags = (props) => {
    // Help from https://www.geeksforgeeks.org/how-to-perform-form-validation-in-react/
    

    // All of the default tag options (William)
    const userTagOptions = [
        "Anime",
        "Binge-Worthy",
        "Clean your Eyes",
        "Diversity",
        "Heartwarming",
        "Horror",
        "Left Halfway Through",
        "LGBTQ+",
        "Mature Themes",
        "Netflix and Chill",
        "Never Again",
        "Nightmare Fuel",
        "Out of Context",
        "Pain",
        "Shock Humor",
        "Ugly CGI",
        "Unfinished",
        "Visually Appealing",
        "Watched During Work",
        "Would Watch Again"
    ]

    const [userTagsLoading, setUserTagsLoading] = useState(false)
    const [userTags, setUserTags] = useState([])
    
    const [customTagsLoading, setCustomTagsLoading] = useState(false)
    const [customTags, setCustomTags] = useState([])

    const [initialTagFlag, setInitialTagFlag] = useState(true)

    const [personalUserTagsLoading, setPersonalUserTagsLoading] = useState(false)
    const [personalCustomTagsLoading, setPersonalCustomTagsLoading] = useState(false)

    const [majorDefaultTag, setMajorDefaultTag] = useState("")
    const [normalDefaultTag, setNormalDefaultTag] = useState("")
    const [minorDefaultTag, setMinorDefaultTag] = useState("")

    const [customTag1, setCustomTag1] = useState("")
    const [customTag2, setCustomTag2] = useState("")
    const [customTag3, setCustomTag3] = useState("")

    const [customTag1Length, setCustomTag1Length] = useState(0)
    const [customTag2Length, setCustomTag2Length] = useState(0)
    const [customTag3Length, setCustomTag3Length] = useState(0)

    const tagsRef = collection(db, "Tags")

    // Help from https://www.rowy.io/blog/firestore-react-query
    const queryTags = async (tagClass) => {

        // Help from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
        const tagMap = new Map();

        const c = query(
            tagsRef,
            where('media_id', '==', props.mediaId),
            where('media_type', '==', props.mediaType),
            where('tag_class', '==', tagClass),

            // Help from https://firebase.google.com/docs/firestore/query-data/order-limit-data
            orderBy('score', 'desc')
        )
        const tagSnapshot = await getDocs(c)
        const tagRes = []

        tagSnapshot.forEach(tag => {
            //console.log("Tag: ", tag.data())
            if (!tagMap.has(tag.data().tag_name)) {
                tagMap.set(tag.data().tag_name, { score: tag.data().score, id: tag.id })
            } else {
                let base = tagMap.get(tag.data().tag_name).score
                let toAdd = tag.data().score
                tagMap.set(tag.data().tag_name, { score: base + toAdd, id: tag.id })
            }
        })

        // Help from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys

        //console.log("Map: ", tagMap)

        // Help from https://dev.to/askyt/how-to-sort-a-map-in-javascript-324a

        // Sorting tagMap by score
        const sortedMap = Array.from(tagMap).sort((a, b) => a[1].score - b[1].score).reverse()
        console.log("Sorted map: ", sortedMap)
        console.log("Map size: ", sortedMap.length)

        let limit;
        if (sortedMap.length > 10) {
            limit = 10
        } else {
            limit = sortedMap.length
        }

        for (let i = 0; i < limit; i++) {
            console.log(sortedMap[i])
            tagRes.push({
                id: sortedMap[i][1].id,
                tag_name: sortedMap[i][0],
                score: sortedMap[i][1].score,
            })
        }

        return tagRes
    }

    const getPersonalTags = async () => {
        const c = query(
            tagsRef,
            where('user_id', '==', props.userID),
            where('media_id', '==', props.mediaId),
            where('media_type', '==', props.mediaType)
        )
        const personalSnapshot = await getDocs(c)
        personalSnapshot.forEach(tag => {
            console.log("Personal Tag: ", tag.data())
            switch (tag.data().tag_type) {
                case ('major'): {
                    setMajorDefaultTag(tag.data().tag_name)
                    break;
                }
                case ('normal'): {
                    setNormalDefaultTag(tag.data().tag_name)
                    break;
                }
                case ('minor'): {
                    setMinorDefaultTag(tag.data().tag_name)
                    break;
                }
                case ('tag1'): {
                    setCustomTag1(tag.data().tag_name)
                    setCustomTag1Length(tag.data().tag_name.length)
                    break;
                }
                case ('tag2'): {
                    setCustomTag2(tag.data().tag_name)
                    setCustomTag2Length(tag.data().tag_name.length)
                    break;
                }
                case ('tag3'): {
                    setCustomTag3(tag.data().tag_name)
                    setCustomTag3Length(tag.data().tag_name.length)
                    break;
                }
                default: {
                    break;
                }
            }
        })
        
    }

    const getTags = async () => {
        setUserTagsLoading(true)
        setCustomTagsLoading(true)
        setPersonalUserTagsLoading(true)
        setPersonalCustomTagsLoading(true)

        const userTagRes = await queryTags("standard")
        const customTagRes = await queryTags("custom")
        setUserTags([...userTagRes])
        setCustomTags([...customTagRes])

        await getPersonalTags()

        setUserTagsLoading(false)
        setCustomTagsLoading(false)
        setPersonalUserTagsLoading(false)
        setPersonalCustomTagsLoading(false)
    }

    const updateTag = async (tagClass, tagType, tagScore, tag) => {
        const q = query(
            tagsRef,
            where('user_id', '==', props.userID),
            where('media_id', '==', props.mediaId),
            where('media_type', '==', props.mediaType),
            where('tag_class', '==', tagClass),
            where('tag_type', '==', tagType)
        )
        console.log("Class:", tagClass)
        console.log("Type:", tagType)
        console.log("Tag:", tag)

        // Help from starRate.js for this (Some of the code may be from Serena's) -WA
        const tagQuerySnapshot = await getDocs(q)
        let tagDuplicates = 0; // This will be used to check for a duplicate tag
        let docId = 0;
        tagQuerySnapshot.forEach((doc) => {
            tagDuplicates++;
            docId = doc.id
        })

        console.log("Tag duplicates:", tagDuplicates)

        if (tag.trim()) {
            if (tagDuplicates > 0) {
                try {
                    await updateDoc(doc(db, "Tags", docId), {
                        tag_name: tag.trim(),
                    })
                    console.log("Tag updated successfully.")
                    alert("Tag updated successfully.")
                } catch (error) {
                    console.error("Error updating tag: ", error);
                    alert("Error updating tag: ", error)
                }
            } else {
                // Based on Serena's code from starRate.js
                try {
                    await addDoc(tagsRef, {
                        media_id: props.mediaId,
                        media_type: props.mediaType,
                        score: tagScore,
                        tag_class: tagClass,
                        tag_name: tag.trim(),
                        tag_type: tagType,
                        user_id: props.userID,
                    });
                    console.log("Tag added successfully.")
                    alert("Tag added successfully.")
                } catch (error) {
                    console.log("Error adding tag: ", error)
                    alert("Error adding tag: ", error)
                }
            }
        }
        else {
            alert("You cannot enter an empty tag.")
        }

        await getTags() // Refreshes the tags -WA

    }

    // Help from https://stackoverflow.com/questions/44671082/how-do-i-programatically-fill-input-field-value-with-react
    const handleCustomTag = async (tag, tagText) => {
        switch (tag) {
            case ("customTag1"): {
                setCustomTag1(tagText)
                setCustomTag1Length(tagText.length)
                break;
            }
            case ("customTag2"): {
                setCustomTag2(tagText)
                setCustomTag2Length(tagText.length)
                break;
            }
            case ("customTag3"): {
                setCustomTag3(tagText)
                setCustomTag3Length(tagText.length)
                break;
            }
            default: {
                break;
            }
        }
    }

    if (initialTagFlag) {
        getTags()
        setInitialTagFlag(false)
    }

    return (
        <>

            <div className="tagDisplay firstDisplay">
                <div className="tagColumn">
                    {userTagsLoading && <p>Loading user tags...</p>}
                    {!userTagsLoading && <h2>User Tags</h2>}
                    {userTags.length > 0 && userTags.map(userTag => (
                        <div className={`tag userTag`} key={userTag.id}>
                            {userTag.tag_name} ({userTag.score})
                        </div>
                    ))}
                </div>
                <div className="tagColumn">
                    {customTagsLoading && <p>Loading custom tags...</p>}
                    {!customTagsLoading && <h2>Custom Tags</h2>}
                    {customTags.length > 0 && customTags.map(customTag => (
                        <div className={`tag customTag`} key={customTag.id}>
                            {customTag.tag_name} ({customTag.score})
                        </div>
                    ))}
                </div>
            </div>

            <h3>Your Tags</h3>
            <hr />

            <div className="tagDisplay">
                <div className="tagColumn">
                    <h4>Standard Tags</h4>

                    <div className="tagGroup">
                        <label htmlFor="majorStandardTag">
                            Major: 
                        </label>
                        <Form.Select
                            className="tagSelect"
                            id="majorStandardTag"
                            name="majorStandardTag"
                            defaultValue={majorDefaultTag ? majorDefaultTag : "Please select a tag"}
                            // Help from https://stackoverflow.com/questions/61858177/how-can-i-get-the-value-from-react-bootstrap-form-select
                            onChange={(e) =>
                                updateTag(
                                    "standard",
                                    "major",
                                    3,
                                    e.target.value
                                )
                            }
                        >
                            {/* Help from https://www.w3schools.com/tags/att_option_disabled.asp */}
                            <option 
                                key={"Select"} 
                                value="Please select a tag"
                                className="unselectableOption"
                                disabled
                            >
                                Please select a tag
                            </option>
                            {/* Copied from Watchlist.js -William */}
                            {/* Help from https://stackoverflow.com/questions/61128847/react-adding-a-default-option-while-using-map-in-select-tag */}
                            {/* And https://www.w3schools.com/tags/att_option_disabled.asp */}
                            {userTagOptions.map((tag) => (
                                <option key={tag} value={tag} selected={tag === majorDefaultTag}>
                                    {tag}
                                </option>
                            ))}
                        </Form.Select>
                    </div>

                    <div className="tagGroup">
                        <label htmlFor="normalStandardTag">
                            Normal: 
                        </label>
                        <Form.Select
                            className="tagSelect"
                            id="normalStandardTag"
                            defaultValue={normalDefaultTag ? normalDefaultTag : "Please select a tag"}
                            name="normalStandardTag"
                            onChange={(e) =>
                                updateTag(
                                    "standard",
                                    "normal",
                                    2,
                                    e.target.value
                                )
                            }
                        >
                            <option 
                                key={"Select"} 
                                value="Please select a tag"
                                className="unselectableOption"
                                disabled
                            >
                                Please select a tag
                            </option>
                            {/* Copied from Watchlist.js -William */}
                            {userTagOptions.map((tag) => (
                                <option key={tag} value={tag} selected={tag === normalDefaultTag}>
                                    {tag}
                                </option>
                            ))}
                        </Form.Select>
                    </div>

                    <div className="tagGroup">
                        <label htmlFor="minorStandardTag">
                            Minor:
                        </label>
                        <Form.Select
                            className="tagSelect"
                            id="minorStandardTag"
                            defaultValue={minorDefaultTag ? minorDefaultTag : "Please select a tag"}
                            name="minorStandardTag"
                            onChange={(e) =>
                                updateTag(
                                    "standard",
                                    "minor",
                                    1,
                                    e.target.value
                                )
                            }
                        >
                            <option 
                                key={"Select"} 
                                value="Please select a tag"
                                className="unselectableOption"
                                disabled
                            >
                                Please select a tag
                            </option>
                            {/* Copied from Watchlist.js -William */}
                            {userTagOptions.map((tag) => (
                                <option key={tag} value={tag} selected={tag === minorDefaultTag}>
                                    {tag}
                                </option>
                            ))}
                        </Form.Select>
                    </div>
                </div>
                <div className="tagColumn">
                    <h4>Custom Tags</h4>

                    <div className="customTagGroup">
                        <div className="customTagGroupLeft">
                            <label htmlFor="customTag1">
                                Tag 1:
                            </label>
                        </div>
                        <div className="customTagGroupEntry">
                            <input 
                                type="text"
                                maxLength="20"
                                className="customTagEntry"
                                id="customTag1"

                                // Help from https://stackoverflow.com/questions/44671082/how-do-i-programatically-fill-input-field-value-with-react
                                value={customTag1 ? customTag1 : ""}
                                onChange={(e) => handleCustomTag("customTag1", e.target.value)}
                            />
                        </div>
                        {20 - customTag1Length}/20 characters remaining.
                        <div className="customTagGroupBtn">
                            <Button 
                                variant="success" 
                                className="customTagBtn"
                                onClick={(e) => {
                                    updateTag(
                                        "custom",
                                        "tag1",
                                        1,
                                        document.getElementById('customTag1').value
                                    )
                                }}
                            >
                                Update
                            </Button>
                        </div>
                    </div>

                    <div className="customTagGroup">
                        <div className="customTagGroupLeft">
                            <label htmlFor="customTag2">
                                Tag 2:
                            </label>
                        </div>
                        <div className="customTagGroupEntry">
                            <input 
                                type="text"
                                maxLength="20"
                                className="customTagEntry"
                                id="customTag2"

                                // Help from https://stackoverflow.com/questions/44671082/how-do-i-programatically-fill-input-field-value-with-react
                                value={customTag2 ? customTag2 : ""}
                                onChange={(e) => handleCustomTag("customTag2", e.target.value)}
                            />
                        </div>
                        {20 - customTag2Length}/20 characters remaining.
                        <div className="customTagGroupBtn">
                            <Button 
                                variant="success" 
                                className="customTagBtn"
                                onClick={(e) => {
                                    updateTag(
                                        "custom",
                                        "tag2",
                                        1,
                                        document.getElementById('customTag2').value
                                    )
                                }}
                            >
                                Update
                            </Button>
                        </div>
                    </div>

                    <div className="customTagGroup">
                        <div className="customTagGroupLeft">
                            <label htmlFor="customTag3">
                                Tag 3:
                            </label>
                        </div>
                        <div className="customTagGroupEntry">
                            <input 
                                type="text"
                                maxLength="20"
                                className="customTagEntry"
                                id="customTag3"

                                // Help from https://stackoverflow.com/questions/44671082/how-do-i-programatically-fill-input-field-value-with-react
                                value={customTag3 ? customTag3 : ""}
                                onChange={(e) => handleCustomTag("customTag3", e.target.value)}
                            />
                        </div>
                        <div className="customTagGroupBtn">
                            <Button 
                                variant="success" 
                                className="customTagBtn"
                                onClick={(e) => {
                                    updateTag(
                                        "custom",
                                        "tag3",
                                        1,
                                        document.getElementById('customTag3').value
                                    )
                                }}
                            >
                                Update
                            </Button>
                        </div>
                        {20 - customTag3Length}/20 characters remaining.
                    </div>
                </div>
            </div>
        </>
    )
}

export default FetchTags;