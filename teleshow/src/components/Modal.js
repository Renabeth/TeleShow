// Help from https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/#
import React from "react"


const Modal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;

    return (

        <div
            
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "auto",
            }}
        >
        <div
            style={{
                backgroundColor: "gray",
                height: '90%',
                width: '90%',
                margin: "auto",
                padding: "2%",
                border: "2px solid #000",
                borderRadius: "10px",
                boxShadow: "2px solid black",
                overflow: "auto",
            }}
            >
                {/* Help from https://www.w3schools.com/howto/howto_css_modals.asp */}
                <span style={{ cursor: "pointer", textAlign: "right" }} onClick={onClose}>&times;</span>
                {children}
            </div>
        </div>

    );
};

export default Modal;