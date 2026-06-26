import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (container) {
  try {
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (e: any) {
    console.error("Mounting Error:", e);
    container.innerHTML = `<div style="color:red; padding: 20px;">Failed to mount: ${e.message}</div>`;
  }
} else {
  console.error("Root element not found");
}