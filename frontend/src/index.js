import React from "react";
import { createRoot } from "react-dom/client";
import AuthWrapper from "./components/AuthWrapper";
import "./styles.css";

const root = createRoot(document.getElementById("root"));
root.render(<AuthWrapper />);
