import {useState} from "react"
import '../styles/Comment.css'
import './DetailModal.css';

// Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
import { collection, addDoc, getDocs, doc } from "firebase/firestore";
import { db } from "../firebase";

// Help from https://firebase.google.com/docs/firestore/query-data/queries
import { query, where, deleteDoc, updateDoc, limit } from "firebase/firestore";

// Help from https://www.rowy.io/blog/firestore-timestamp
import { serverTimestamp } from 'firebase/firestore'

import Button from "react-bootstrap/Button"

// Help from https://react-bootstrap.netlify.app/docs/components/button-group/
import ButtonGroup from "react-bootstrap/ButtonGroup";

// Help from https://react-bootstrap.netlify.app/docs/forms/form-control/
import Form from 'react-bootstrap/Form';

// Help from https://react-bootstrap.netlify.app/docs/components/modal/
import Modal from 'react-bootstrap/Modal';

// Help from https://react-icons.github.io/react-icons/icons/bs/
import { BsPencilFill, BsTrashFill, BsPlusLg } from "react-icons/bs";

const FetchComments = (props) => {

    // Help from https://www.geeksforgeeks.org/how-to-perform-form-validation-in-react/
    const [commentData, setCommentData] = useState({
        text: '',
        remainingCharacters: 255,
    })

    const [editCommentData, setEditCommentData] = useState({
        text: '',
        remainingCharacters: 255,
    })

    const handleCommentChange = (e) => {
        const { name, value } = e.target;
        setCommentData({
            ...commentData,
            [name]: value,
        })
    }

    const handleEditCommentChange = (e) => {
        const {name, value} = e.target;
        setEditCommentData({
            ...editCommentData,
            [name]: value,
        })
    }

    const [editCommentId, setEditCommentId] = useState("")
    const [editCommentSpoiler, setEditCommentSpoiler] = useState(false)
    const [editModalLoading, setEditModalLoading] = useState(false)

    // Help from https://react-bootstrap.netlify.app/docs/components/modal/
    const [showEdit, setShowEdit] = useState(false)
    const handleCloseEdit = () => {
        setShowEdit(false)
    }
    const handleShowEdit = async (id, text, spoiler) => {
        setEditModalLoading(true)
        editCommentData.text = text
        setEditCommentSpoiler(spoiler)
        setEditCommentId(id)
        setShowEdit(true)
        setEditModalLoading(false)
    }

    const [commentLoading, setCommentLoading] = useState(false)
    const [comments, setComments] = useState([])
    const [initialCommentsFlag, setInitialCommentsFlag] = useState(true)
    const [displayMode, setDisplayMode] = useState(props.displayMode)

    const [spoilers, setSpoilers] = useState(false)

    // Help from https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/
    const toggleSpoilers = () => {
        setSpoilers((prevMode) => !prevMode)
    }

    // Help from https://www.rowy.io/blog/firestore-react-query
    const queryComments = async () => {
        const commentsRef = collection(db, "Comments")
        const c = query(
            commentsRef,
            where('media_id', '==', props.mediaId),
            where('media_type', '==', props.mediaType)/*,
            orderBy('score')*/
        )
        const commentSnapshot = await getDocs(c)
        const commentRes = []
        commentSnapshot.forEach(comment => {
            commentRes.push({
                id: comment.id,
                ...comment.data()
            })
        })
        
        return commentRes
    }

    const getComments = async () => {
        setCommentLoading(true)
        setDisplayMode(props.displayMode)
        const commentRes = await queryComments(props)
        setComments([...commentRes])
        setCommentLoading(false)
    }

    const AddComment = async () => {
        // Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
        const commentsRef = collection(db, "Comments")

        if (commentData.text.trim() !== "") {
            try {
                const commentRef = await addDoc(commentsRef, {
                    user_id: props.userID,
                    media_id: props.mediaId,
                    media_type: props.mediaType,
                    text: commentData.text,
                    score: 0,
                    isEdited: "no",
                
                    // Help from https://www.rowy.io/blog/firestore-timestamp
                    date_added: serverTimestamp(),
    
                    username: props.displayName,
                    profilePic: "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg",

                    // Help from https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox
                    spoiler: document.getElementById('spoiler').checked,
                })
                console.log("Wrote comment with ID: ", commentRef.id)
                alert("Comment added.")
                commentData.text = "" // Resets the comment text box's text - WA
                await getComments()
            } catch (e) {
                console.error("Error adding comment: ", e)
            }
        }
        else {
            alert("No content in comment detected.")
        }
    }

    const updateComment = async (commentId) => {

        if (editCommentData.text.trim()) {
            // Code based on FetchTags.js -WA
            try {
                await updateDoc(doc(db, "Comments", commentId), {
                    text: editCommentData.text,
                    isEdited: 'yes',
                    spoiler: document.getElementById('editSpoiler').checked,
                })
                console.log("Comment updated successfully.")
                alert("Comment updated successfully.")
            } catch (error) {
                console.log("Error updating comment: ", error)
                alert("Error updating comment: ", error)
            }
        } else {
            alert("You cannot enter an empty comment.")
        }

        await getComments();
    }

    const deleteComment = async (commentId) => {
        // Help from https://dev.to/rajatamil/firebase-v9-firestore-delete-document-using-deletedoc-5bjh
        await deleteDoc(doc(db, "Comments", commentId))
        .then(() => {
            console.log("Comment deleted successfully.")
            alert("Comment deleted successfully.")
        })
        .catch(error => {
            console.log(error)
            alert("Error trying to delete comment: ", error)
        })

        await getComments()
    }

    if (initialCommentsFlag) {
        getComments()
        setInitialCommentsFlag(false)
    }

    return (
        <>
            <h3>Comments</h3>

            {/* Help from https://www.geeksforgeeks.org/how-to-perform-form-validation-in-react/ */}
            {/* And https://react-bootstrap.netlify.app/docs/forms/form-control/ */}
            <textarea 
            className={`commentTextBox ${displayMode==="lightMode" ? "textBox-light" : "textBox-dark" }`} 
            rows={5} 
            placeholder="Add a Comment..." 
            name="text" 
            value={commentData.text} 
            onChange={handleCommentChange}
            maxLength={255} />

            <p>{ `${commentData.remainingCharacters - commentData.text.length}/255 characters remaining.` }</p>

            {/* Help from https://react-bootstrap.netlify.app/docs/forms/checks-radios/ */}
            <Form.Group>
                <Form.Check id="spoiler" label="Spoiler?" />
            </Form.Group>
            
            <Button variant="success" onClick={async () => await AddComment()}>
                <BsPlusLg /> Add a Comment
            </Button>
            <br /><br />

            {/* Help from https://react-bootstrap.netlify.app/docs/forms/checks-radios/ */}
            <Form.Check type="switch" onClick={toggleSpoilers} label="Show Spoilers?" />
            <br />


            {/* Help from https://react-bootstrap.netlify.app/docs/components/modal/ */}
            { editModalLoading ? "Loading..." : <Modal
                show={showEdit}
                onHide={handleCloseEdit}
                backdrop="static"
                keyboard={false}
                dialogClassName="detail-modal" // From DetailModal.css
            >
                <Modal.Header closeButton>
                    <Modal.Title>Edit Comment</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Help from https://www.geeksforgeeks.org/how-to-perform-form-validation-in-react/ */}
                    {/* And https://react-bootstrap.netlify.app/docs/forms/form-control/ */}
                    <textarea 
                        className={`commentTextBox textBox-dark`} 
                        rows={5} 
                        placeholder="Edit your Comment..." 
                        name="editText" 
                        value={editCommentData.text} 
                        onChange={handleEditCommentChange}
                        maxLength={255} />

                        <p>{ `${editCommentData.remainingCharacters - editCommentData.text.length}/255 characters remaining.` }</p>

                        {/* Help from https://react-bootstrap.netlify.app/docs/forms/checks-radios/ */}
                        <Form.Group>
                            {/* Help from https://stackoverflow.com/questions/59117030/how-to-precheck-some-checkbox-in-reactjs */}
                            <Form.Check id="editSpoiler" label="Spoiler?" /*value={editCommentSpoiler ? true : false }*/ />
                        </Form.Group>
            
                        <Button variant="success" onClick={async () => await updateComment(editCommentId)}>
                            <BsPencilFill /> Update Comment
                        </Button>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        variant="outline-secondary" // Based on Moses's code from DetailModal.js
                        onClick={() => handleCloseEdit()}
                        style={{ backgroundColor: "silver" }} // Based on code from DetailModal.js (I believe the code was Moses's)
                    >
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>}


            <div className="comments">
                {commentLoading && <p>Loading...</p>}
                {comments.length > 0 && comments.map(comment => (
                    <div className={`comment ${displayMode==="lightMode" ? "comment-light" : "comment-dark" }`} key={comment.id}>
                        <div className="commentHead">
                            <div className="commentHeadPic">
                                <img className="commentProfilePic" src={comment.profilePic} alt="profile pic" />
                            </div>
                            <div className="commentHeadUsername">
                                <h4 className="commentUsername">{comment.username}</h4>
                                
                                {/* Help from https://stackoverflow.com/questions/52247445/how-do-i-convert-a-firestore-date-timestamp-to-a-js-date */}
                                {/* And https://stackoverflow.com/questions/56727191/typeerror-cannot-read-property-todate-of-undefined */}
                                <p>Created {comment.date_added.toDate().toDateString() } {(comment.isEdited === "yes") ? "(Edited)" : ""} { comment.spoiler ? <strong> (Spoiler)</strong> : ""}</p>
                            </div>
                        </div>
                        
                        <div className="commentText">
                            { comment.spoiler && !spoilers ? "This comment contains spoilers." : comment.text}
                        </div>

                        { comment.user_id === props.userID ? 
                            <ButtonGroup>
                                <Button
                                    variant="success"
                                    style={{marginTop: "5px"}}
                                    onClick={async () => await handleShowEdit(comment.id, comment.text, comment.spoiler)}
                                >
                                    <BsPencilFill /> Edit My Comment
                                </Button>
                                <Button 
                                    variant="danger"
                                    style={{marginTop: "5px"}}
                                    onClick={async () => await deleteComment(comment.id)}
                                >
                                    <BsTrashFill /> Delete My Comment
                                </Button>
                            </ButtonGroup>
                             : ""
                        }
                    </div>
                ))}
            </div>
        </>
    )
}

export default FetchComments;

/*

Other Resources:
- https://www.w3schools.com/tags/att_input_type_checkbox.asp
- https://react-bootstrap.netlify.app/docs/forms/overview/
- https://react-bootstrap.netlify.app/docs/forms/checks-radios/
- https://www.codeover.in/blog/how-to-pass-boolean-values-in-react-props
- https://stackoverflow.com/questions/60816731/how-are-boolean-props-used-in-react
- https://github.com/webdriverio/webdriverio/discussions/8426
- https://www.reddit.com/r/reactjs/comments/wt0kw0/is_using_a_boolean_to_render_a_modal_an/
- https://www.freecodecamp.org/news/react-props-cheatsheet/
- https://stackoverflow.com/questions/39326300/why-we-cannot-pass-boolean-value-as-props-in-react-it-always-demands-string-to
- https://stackoverflow.com/questions/56727191/typeerror-cannot-read-property-todate-of-undefined
- https://react-bootstrap.netlify.app/docs/forms/form-text/
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox

*/