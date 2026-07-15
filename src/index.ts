import { app } from "./app.js";

// Render (and most hosts) assign the port via PORT - fall back to 3000 locally.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
