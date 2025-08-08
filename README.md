# Ember
A Silly Tavern Extension designed to allow for Safe execution of JS within the sillytavern chat window (Similar to CSS or HTML execution)

If shit broken me sleeping... so tired...

## How to Use Ember

Simply write JavaScript in regular code blocks! No special formatting required.

**Example:**
```javascript
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 200;
root.appendChild(canvas);

const ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(50, 50, 100, 50);
```

**Key Points:**

1.  **Use the `root` Element**
    Your code runs in a sandbox with a `div` called `root`. Append all your visual elements to `root` to make them visible.

2.  **Libraries Available**
    All libraries (`d3`, `three`, `p5`, `anime`, `Chart`, `Matter`) are automatically loaded and ready to use - no imports needed!
