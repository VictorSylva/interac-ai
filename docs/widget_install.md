# How to Add Interact Chat Widget to Your Website

You can add the Interact Chat Widget to any website (WordPress, Wix, Shopify, Custom HTML) using an `iframe`.

## Option 1: The Simple Iframe (Recommended)

Copy and paste this code into your website's footer or a "Custom HTML" block.

```html
<!-- Interact Chat Widget -->
<iframe
  src="https://interact-b42f1.web.app/"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; pointer-events: none;"
  title="Chat Widget"
></iframe>
```

**Note on Pointer Events:**

- The `pointer-events: none;` style ensures the transparent background of the iframe doesn't block clicks on your website.
- The internal code of the widget (inside the iframe) re-enables pointer events for the actual chat button and window.

## Option 2: Full Screen Link

If you don't want an embedded widget, you can simply add a link:

```html
<a href="https://interact-b42f1.web.app/" target="_blank">Chat with us</a>
```

## Configuration

The widget automatically connects to the backend.

- **Default Business**: It connects to the default business profile.
- **Custom Business**: (Advanced) You can pass query parameters if you enabled multi-tenancy in the frontend router, e.g., `?business_id=your-email@com`.
