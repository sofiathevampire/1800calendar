import express from "express";
const app = express();

app.use(express.static("."));

app.listen(3000, () => {
  console.log("App running at http://localhost:3000");
});
