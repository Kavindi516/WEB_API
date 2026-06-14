const express = require('express');
const app = express();

const port = process.env.PORT || 5000;


app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Start the server
if(process.env.NODE_ENV !== 'production') {
app.listen(port, () => {
  console.log(`Server running at ${port}`);
});
}

module.exports = app;