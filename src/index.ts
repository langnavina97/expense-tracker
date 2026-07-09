import { app } from "./app.js";

// Start the server and listen on port 3000.
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
