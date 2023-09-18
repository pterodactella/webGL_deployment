class PointerHandler {
    constructor(canvas, pointers) {
      this.canvas = canvas;
      this.pointers = pointers;
      this.bindEvents();
    }
  
    bindEvents() {
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      this.canvas.addEventListener('mousedown', () => this.onMouseDown());
      this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
      window.addEventListener('mouseup', () => this.onMouseUp());
    }
  
    onMouseMove(e) {
      this.pointers[0].moved = this.pointers[0].down;
      this.pointers[0].dx = (e.offsetX - this.pointers[0].x) * 10.0;
      this.pointers[0].dy = (e.offsetY - this.pointers[0].y) * 10.0;
      this.pointers[0].x = e.offsetX;
      this.pointers[0].y = e.offsetY;
    }
  
    onMouseDown() {
      this.pointers[0].down = true;
      this.pointers[0].color = [Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2];
    }
  
    onTouchStart(e) {
      e.preventDefault();
      const touches = e.targetTouches;
      for (let i = 0; i < touches.length; i++) {
        if (i >= this.pointers.length) this.pointers.push(new pointerPrototype());
  
        this.pointers[i].id = touches[i].identifier;
        this.pointers[i].down = true;
        this.pointers[i].x = touches[i].pageX;
        this.pointers[i].y = touches[i].pageY;
        this.pointers[i].color = [Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2];
      }
    }
  
    onMouseUp() {
      this.pointers[0].down = false;
    }
  }
  
export default PointerHandler;
  