import React from "react";
import "./BookCard.css";

const BookCard = ({ book }) => {
    const { title, image, pagesRead, totalPages } = book;
    const percentage = Math.round((pagesRead / totalPages) * 100);

    return (
        <div className="book-card">
            <img src={image} alt={title} className="book-image" />
            <div className="book-content">
                <h3>{title}</h3>
                <p>{`${pagesRead} / ${totalPages} Read`}</p>
                <div className="progress-bar">
                    <div className="progress" style={{ width: `${percentage}%` }} />
                </div>
            </div>
        </div>
  );
};

export default BookCard;