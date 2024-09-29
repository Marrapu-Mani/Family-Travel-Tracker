import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Create a new PostgreSQL client using the DATABASE_URL from environment variables
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// Connect to the database with error handling
const connectToDatabase = async () => {
  try {
    await db.connect();
    console.log("Connected to PostgreSQL database");
  } catch (err) {
    console.error("Failed to connect to the database", err);
    process.exit(1); // Exit the process if database connection fails
  }
};

connectToDatabase();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());  // Add this for JSON parsing
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Mani", color: "teal" },
  { id: 2, name: "Sai", color: "powderblue" },
];

async function checkVisited() {
  try {
    const result = await db.query(
      "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",
      [currentUserId]
    );
    return result.rows.map(country => country.country_code);
  } catch (err) {
    console.error("Error fetching visited countries", err);
    throw err;
  }
}

async function getCurrentUser() {
  try {
    const result = await db.query("SELECT * FROM users");
    users = result.rows;
    return users.find(user => user.id == currentUserId);
  } catch (err) {
    console.error("Error fetching users", err);
    throw err;
  }
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    res.render("index.ejs", {
      countries,
      total: countries.length,
      users,
      color: currentUser.color,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  const input = req.body.country;
  const currentUser = await getCurrentUser();

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length > 0) {
      const countryCode = result.rows[0].country_code;
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    } else {
      res.status(404).send("Country not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    currentUserId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Listen on the correct port and IP address
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});
