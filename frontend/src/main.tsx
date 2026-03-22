import React from "react";
import ReactDOM from "react-dom/client";
import { defaultTheme, Provider } from "@adobe/react-spectrum";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider theme={defaultTheme} colorScheme="light" locale="ru-RU">
      <App />
    </Provider>
  </React.StrictMode>
);
