import React from "react";
import books from "./data/books";
import BookCard from "./components/BookCard";

function App() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>My Bookshelf</h1>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

export default App;