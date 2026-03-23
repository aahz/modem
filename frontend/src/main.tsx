import React from "react";
import ReactDOM from "react-dom/client";
import {Provider} from '@react-spectrum/s2';
import { App } from "./App";

import '@react-spectrum/s2/page.css';
import "./styles.css";

function Main() {
    return (
      <React.StrictMode>
          <Provider background="base" colorScheme="dark" locale="en-US">
              <App />
          </Provider>
      </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Main />
);
