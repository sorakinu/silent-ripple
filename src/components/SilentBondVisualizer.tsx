import { useEffect, useRef, useCallback } from 'react';
import p5 from 'p5';
import { motion, AnimatePresence } from 'framer-motion';
import twilightSky from '@/assets/twilight-sky.jpg';

interface VisualElement {
  update: () => void;
  display: (p: p5) => void;
  isDead: () => boolean;
}

class Ripple implements VisualElement {
  x: number;
  y: number;
  r: number;
  alpha: number;
  maxR: number;
  growthRate: number;
  color: [number, number, number];

  constructor(x: number, y: number, speed: 'slow' | 'medium') {
    this.x = x;
    this.y = y;
    this.r = 0;
    this.alpha = 150; // Slightly more visible

    if (speed === 'slow') {
      this.maxR = 500;
      this.growthRate = 0.8; // Much slower growth = longer duration
      this.color = [255, 220, 130]; // Soft golden
    } else {
      this.maxR = 280;
      this.growthRate = 1.2; // Slower growth
      this.color = [220, 235, 255]; // Pale blue-white
    }
  }

  update() {
    this.r += this.growthRate;
    this.alpha -= 0.3; // Much slower fade = longer visible
  }

  display(p: p5) {
    p.noFill();
    p.strokeWeight(1.5);
    p.stroke(this.color[0], this.color[1], this.color[2], this.alpha);
    p.ellipse(this.x, this.y, this.r * 2);

    // Double ripple effect
    p.stroke(this.color[0], this.color[1], this.color[2], this.alpha * 0.4);
    p.strokeWeight(0.8);
    p.ellipse(this.x, this.y, this.r * 2 + 15);

    // Third subtle ring
    p.stroke(this.color[0], this.color[1], this.color[2], this.alpha * 0.2);
    p.strokeWeight(0.5);
    p.ellipse(this.x, this.y, this.r * 2 + 30);
  }

  isDead() {
    return this.alpha <= 0 || this.r > this.maxR;
  }
}

class Particle implements VisualElement {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;

  constructor(p: p5, x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = p.random(p.TWO_PI);
    const speed = p.random(0.3, 1.5);
    this.vx = p.cos(angle) * speed;
    this.vy = p.sin(angle) * speed;
    this.alpha = 180;
    this.size = p.random(2, 5);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.015; // Very gentle gravity
    this.alpha -= 0.6; // Much slower fade = longer visible
    this.size *= 0.997; // Slower shrink
  }

  display(p: p5) {
    p.noStroke();

    // Soft glow
    p.fill(255, 245, 180, this.alpha * 0.25);
    p.circle(this.x, this.y, this.size * 4);

    // Inner glow
    p.fill(255, 250, 200, this.alpha * 0.5);
    p.circle(this.x, this.y, this.size * 2);

    // Core
    p.fill(255, 255, 230, this.alpha);
    p.circle(this.x, this.y, this.size);
  }

  isDead() {
    return this.alpha <= 0;
  }
}

const SilentBondVisualizer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const elementsRef = useRef<VisualElement[]>([]);
  const lastClickTimeRef = useRef<number>(0);
  const bgImageRef = useRef<p5.Image | null>(null);

  const handleSave = useCallback(() => {
    if (p5InstanceRef.current) {
      p5InstanceRef.current.saveCanvas('silent-bond-' + Date.now(), 'png');
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      let gradientBg: p5.Graphics;
      let bgImage: p5.Image | null = null;

      const createGradientBackground = () => {
        gradientBg = p.createGraphics(p.width, p.height);
        gradientBg.noFill();

        // Deep indigo to darker gradient
        for (let y = 0; y < p.height; y++) {
          const inter = p.map(y, 0, p.height, 0, 1);
          const c = p.lerpColor(
            p.color(8, 20, 38),
            p.color(4, 8, 18),
            inter
          );
          gradientBg.stroke(c);
          gradientBg.line(0, y, p.width, y);
        }
      };

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.imageMode(p.CENTER);
        createGradientBackground();
        
        // Load image after setup
        p.loadImage(twilightSky, (img) => {
          bgImage = img;
        });
      };

      p.draw = () => {
        // Background with image
        if (bgImage && bgImage.width > 0) {
          p.push();
          p.tint(60, 80, 120, 200); // Darken and shift to deep blue
          p.translate(p.width / 2, p.height / 2);
          const scale = Math.max(
            p.width / bgImage.width,
            p.height / bgImage.height
          );
          p.image(
            bgImage,
            0,
            0,
            bgImage.width * scale,
            bgImage.height * scale
          );
          p.pop();
        } else {
          p.image(gradientBg, 0, 0);
        }

        // Semi-transparent overlay for trail effect
        p.fill(8, 18, 35, 12);
        p.noStroke();
        p.rect(0, 0, p.width, p.height);

        // Update and draw elements
        for (let i = elementsRef.current.length - 1; i >= 0; i--) {
          elementsRef.current[i].update();
          elementsRef.current[i].display(p);
          if (elementsRef.current[i].isDead()) {
            elementsRef.current.splice(i, 1);
          }
        }
      };

      p.mousePressed = () => {
        // Ignore clicks on save button area
        if (p.mouseX > p.width - 180 && p.mouseY > p.height - 80) return;

        const currentTime = p.millis();
        const interval = currentTime - lastClickTimeRef.current;
        lastClickTimeRef.current = currentTime;

        if (interval > 600) {
          // Slow rhythm: large ripple
          elementsRef.current.push(new Ripple(p.mouseX, p.mouseY, 'slow'));
        } else if (interval > 300) {
          // Medium rhythm: medium ripple
          elementsRef.current.push(new Ripple(p.mouseX, p.mouseY, 'medium'));
        } else {
          // Fast rhythm: scatter particles
          for (let i = 0; i < 10; i++) {
            elementsRef.current.push(new Particle(p, p.mouseX, p.mouseY));
          }
        }
      };

      // Touch support via canvas event - use type assertion
      (p as any).touchStarted = function() {
        p.mousePressed();
        return false;
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        createGradientBackground();
      };
    };

    p5InstanceRef.current = new p5(sketch, containerRef.current);

    return () => {
      p5InstanceRef.current?.remove();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div ref={containerRef} className="absolute inset-0" />
      
      <AnimatePresence>
        <motion.div
          className="hint-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          Tap to create ripples
        </motion.div>
      </AnimatePresence>

      <motion.button
        className="save-button"
        onClick={handleSave}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        この瞬間を保存
      </motion.button>
    </div>
  );
};

export default SilentBondVisualizer;
