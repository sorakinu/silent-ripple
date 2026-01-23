import { useEffect, useRef, useCallback } from 'react';
import p5 from 'p5';
import { motion, AnimatePresence } from 'framer-motion';
import twilightSky from '@/assets/twilight-sky.jpg';

interface VisualElement {
  update: () => void;
  display: (p: p5) => void;
  isDead: () => boolean;
}

// Heart rate tracker for atmosphere control
class HeartRateTracker {
  private intervals: number[] = [];
  private maxSamples = 10;
  
  addInterval(interval: number) {
    this.intervals.push(interval);
    if (this.intervals.length > this.maxSamples) {
      this.intervals.shift();
    }
  }
  
  // Returns a normalized "calm" value from 0 (anxious) to 1 (calm)
  getCalmness(): number {
    if (this.intervals.length < 2) return 0.5;
    const avg = this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length;
    // Map: <200ms = anxious (0), >800ms = calm (1)
    return Math.min(1, Math.max(0, (avg - 200) / 600));
  }
}

class Ripple implements VisualElement {
  x: number;
  y: number;
  r: number;
  alpha: number;
  maxR: number;
  baseGrowthRate: number;
  color: [number, number, number];
  phase: number; // For wobble effect
  wobbleAmount: number;
  wobbleSpeed: number;
  dissolved: boolean;

  constructor(x: number, y: number, speed: 'slow' | 'medium', p: p5) {
    this.x = x;
    this.y = y;
    this.r = 0;
    this.alpha = 180;
    this.dissolved = false;
    this.phase = p.random(p.TWO_PI);
    this.wobbleSpeed = p.random(0.02, 0.04);

    if (speed === 'slow') {
      this.maxR = 600;
      this.baseGrowthRate = 1.2;
      this.color = [255, 220, 130]; // Soft golden
      this.wobbleAmount = 8; // More organic wobble
    } else {
      this.maxR = 320;
      this.baseGrowthRate = 1.5;
      this.color = [220, 235, 255]; // Pale blue-white
      this.wobbleAmount = 4;
    }
  }

  update() {
    // Deceleration aesthetics: slower as it expands
    const progress = this.r / this.maxR;
    const deceleration = Math.pow(1 - progress, 0.5); // Gradually slows
    this.r += this.baseGrowthRate * deceleration;
    
    // Instead of disappearing, dissolve into background
    if (progress > 0.7) {
      // Start dissolving
      this.alpha -= 0.8 * (progress - 0.7) / 0.3;
      this.dissolved = true;
    }
    
    this.phase += this.wobbleSpeed;
  }

  display(p: p5) {
    p.noFill();
    
    // Draw wobbling ripple using vertices
    const segments = 60;
    for (let ring = 0; ring < 3; ring++) {
      const ringOffset = ring * 15;
      const ringAlpha = this.alpha * (1 - ring * 0.3);
      const strokeW = ring === 0 ? 1.5 : (ring === 1 ? 0.8 : 0.5);
      
      p.strokeWeight(strokeW);
      p.stroke(this.color[0], this.color[1], this.color[2], ringAlpha);
      
      p.beginShape();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * p.TWO_PI;
        // Organic wobble: multiple sine waves for natural water-like distortion
        const wobble = 
          Math.sin(angle * 3 + this.phase) * this.wobbleAmount +
          Math.sin(angle * 5 - this.phase * 1.3) * (this.wobbleAmount * 0.5) +
          Math.sin(angle * 7 + this.phase * 0.7) * (this.wobbleAmount * 0.25);
        
        const radius = this.r + ringOffset + wobble;
        const px = this.x + Math.cos(angle) * radius;
        const py = this.y + Math.sin(angle) * radius;
        p.vertex(px, py);
      }
      p.endShape(p.CLOSE);
    }
    
    // Soft glow in center when dissolving
    if (this.dissolved) {
      const glowAlpha = this.alpha * 0.3;
      p.noStroke();
      p.fill(this.color[0], this.color[1], this.color[2], glowAlpha);
      p.circle(this.x, this.y, this.r * 0.3);
    }
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
  canvasWidth: number;
  canvasHeight: number;
  edgeAttraction: number;

  constructor(p: p5, x: number, y: number, calmness: number) {
    this.x = x;
    this.y = y;
    this.canvasWidth = p.width;
    this.canvasHeight = p.height;
    
    // Initial burst direction
    const angle = p.random(p.TWO_PI);
    const speed = p.random(0.5, 2);
    this.vx = p.cos(angle) * speed;
    this.vy = p.sin(angle) * speed;
    this.alpha = 200;
    this.size = p.random(2, 5);
    
    // Edge attraction: stronger when user is anxious (low calmness)
    this.edgeAttraction = p.map(calmness, 0, 1, 0.08, 0.02);
  }

  update() {
    // Find nearest edge and create attraction force
    const distToLeft = this.x;
    const distToRight = this.canvasWidth - this.x;
    const distToTop = this.y;
    const distToBottom = this.canvasHeight - this.y;
    
    const minHorizontal = Math.min(distToLeft, distToRight);
    const minVertical = Math.min(distToTop, distToBottom);
    
    // Pull toward nearest edge (absorbing anxiety)
    if (minHorizontal < minVertical) {
      this.vx += distToLeft < distToRight ? -this.edgeAttraction : this.edgeAttraction;
    } else {
      this.vy += distToTop < distToBottom ? -this.edgeAttraction : this.edgeAttraction;
    }
    
    // Apply velocity with slight damping
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.995;
    this.vy *= 0.995;
    
    // Fade faster as approaching edge
    const edgeDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    const edgeFade = edgeDist < 100 ? 1.5 : 0.5;
    this.alpha -= edgeFade;
    
    this.size *= 0.998;
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
    return this.alpha <= 0 || 
           this.x < -20 || this.x > this.canvasWidth + 20 ||
           this.y < -20 || this.y > this.canvasHeight + 20;
  }
}

const SilentBondVisualizer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const elementsRef = useRef<VisualElement[]>([]);
  const lastClickTimeRef = useRef<number>(0);
  const bgImageRef = useRef<p5.Image | null>(null);
  const heartRateRef = useRef<HeartRateTracker>(new HeartRateTracker());
  const atmosphereRef = useRef<number>(0.5); // 0 = anxious, 1 = calm

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
        // Smoothly transition atmosphere based on heart rate
        const targetAtmosphere = heartRateRef.current.getCalmness();
        atmosphereRef.current += (targetAtmosphere - atmosphereRef.current) * 0.02;
        
        // Background with image - tint shifts based on atmosphere
        if (bgImage && bgImage.width > 0) {
          p.push();
          // More blue when anxious, warmer when calm
          const tintR = p.lerp(40, 80, atmosphereRef.current);
          const tintG = p.lerp(60, 90, atmosphereRef.current);
          const tintB = p.lerp(140, 100, atmosphereRef.current);
          p.tint(tintR, tintG, tintB, 200);
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

        // Semi-transparent overlay - opacity varies with atmosphere
        const overlayAlpha = p.lerp(18, 8, atmosphereRef.current);
        p.fill(8, 18, 35, overlayAlpha);
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
        
        // Track heart rate
        if (interval < 2000) {
          heartRateRef.current.addInterval(interval);
        }
        
        const calmness = heartRateRef.current.getCalmness();

        if (interval > 600) {
          // Slow rhythm: large ripple with organic wobble
          elementsRef.current.push(new Ripple(p.mouseX, p.mouseY, 'slow', p));
        } else if (interval > 300) {
          // Medium rhythm: medium ripple
          elementsRef.current.push(new Ripple(p.mouseX, p.mouseY, 'medium', p));
        } else {
          // Fast rhythm: scatter particles that get absorbed by edges
          const particleCount = Math.floor(p.lerp(15, 8, calmness));
          for (let i = 0; i < particleCount; i++) {
            elementsRef.current.push(new Particle(p, p.mouseX, p.mouseY, calmness));
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
