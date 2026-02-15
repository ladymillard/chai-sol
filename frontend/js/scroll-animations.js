/**
 * ChAI Scroll Animations Module
 * Egyptian-themed scroll reveal animations using Intersection Observer API
 * Supports accessibility (prefers-reduced-motion) and user preferences
 */

class ScrollAnimations {
    constructor(options = {}) {
        this.options = {
            threshold: options.threshold || 0.15,
            rootMargin: options.rootMargin || '0px 0px -100px 0px',
            animateOnce: options.animateOnce !== false, // true by default
            staggerDelay: options.staggerDelay || 60, // milliseconds between stagger items
            ...options
        };
        
        this.observer = null;
        this.animationsEnabled = true;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        this.init();
    }

    init() {
        // Check user preference for reduced motion
        if (this.prefersReducedMotion) {
            this.animationsEnabled = false;
            console.log('ChAI: Reduced motion detected, animations disabled');
        }

        // Check localStorage for user preference
        const savedPreference = localStorage.getItem('chai-animations-enabled');
        if (savedPreference !== null) {
            this.animationsEnabled = savedPreference === 'true';
        }

        // Setup Intersection Observer
        if (this.animationsEnabled) {
            this.setupObserver();
            this.observeElements();
        } else {
            this.showAllElements();
        }

        // Listen for dynamic content changes
        this.setupMutationObserver();
    }

    setupObserver() {
        const observerOptions = {
            threshold: this.options.threshold,
            rootMargin: this.options.rootMargin
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target);
                    
                    // Unobserve if animateOnce is true
                    if (this.options.animateOnce) {
                        this.observer.unobserve(entry.target);
                    }
                } else if (!this.options.animateOnce) {
                    // Reset animation if element leaves viewport and animateOnce is false
                    this.resetElement(entry.target);
                }
            });
        }, observerOptions);
    }

    observeElements() {
        if (!this.observer) return;

        // Observe all elements with animation classes
        const elements = document.querySelectorAll('.reveal, .reveal-fade, .reveal-slide-left, .reveal-slide-right, .reveal-slide-up, .reveal-zoom, .reveal-papyrus, .reveal-hieroglyph, .stagger');
        
        elements.forEach(el => {
            // Add initial state if not already animated
            if (!el.classList.contains('visible')) {
                this.observer.observe(el);
            }
        });
    }

    animateElement(element) {
        // Add visible class to trigger CSS animation
        element.classList.add('visible');

        // Handle staggered children
        if (element.classList.contains('stagger')) {
            this.animateStaggeredChildren(element);
        }

        // Dispatch custom event for additional hooks
        element.dispatchEvent(new CustomEvent('chai-animated', {
            bubbles: true,
            detail: { element }
        }));
    }

    animateStaggeredChildren(parent) {
        const children = parent.querySelectorAll('.reveal-item');
        children.forEach((child, index) => {
            setTimeout(() => {
                child.classList.add('visible');
            }, index * this.options.staggerDelay);
        });
    }

    resetElement(element) {
        element.classList.remove('visible');
        
        // Reset staggered children
        if (element.classList.contains('stagger')) {
            const children = element.querySelectorAll('.reveal-item');
            children.forEach(child => {
                child.classList.remove('visible');
            });
        }
    }

    showAllElements() {
        // Immediately show all elements without animation
        const elements = document.querySelectorAll('.reveal, .reveal-fade, .reveal-slide-left, .reveal-slide-right, .reveal-slide-up, .reveal-zoom, .reveal-papyrus, .reveal-hieroglyph, .stagger');
        elements.forEach(el => {
            el.classList.add('visible', 'no-animation');
        });
    }

    setupMutationObserver() {
        // Watch for dynamically added content
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the node itself needs observing
                        if (this.shouldObserve(node)) {
                            this.observer?.observe(node);
                        }
                        // Check children
                        const childElements = node.querySelectorAll?.('.reveal, .reveal-fade, .reveal-slide-left, .reveal-slide-right, .reveal-slide-up, .reveal-zoom, .reveal-papyrus, .reveal-hieroglyph, .stagger');
                        childElements?.forEach(el => {
                            if (!el.classList.contains('visible')) {
                                this.observer?.observe(el);
                            }
                        });
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    shouldObserve(element) {
        return element.classList?.contains('reveal') ||
               element.classList?.contains('reveal-fade') ||
               element.classList?.contains('reveal-slide-left') ||
               element.classList?.contains('reveal-slide-right') ||
               element.classList?.contains('reveal-slide-up') ||
               element.classList?.contains('reveal-zoom') ||
               element.classList?.contains('reveal-papyrus') ||
               element.classList?.contains('reveal-hieroglyph') ||
               element.classList?.contains('stagger');
    }

    toggle(enabled) {
        this.animationsEnabled = enabled;
        localStorage.setItem('chai-animations-enabled', enabled.toString());

        if (enabled && !this.prefersReducedMotion) {
            // Re-enable animations
            if (!this.observer) {
                this.setupObserver();
            }
            this.observeElements();
        } else {
            // Disable animations
            if (this.observer) {
                this.observer.disconnect();
            }
            this.showAllElements();
        }

        // Dispatch event for UI updates
        document.dispatchEvent(new CustomEvent('chai-animations-toggled', {
            detail: { enabled }
        }));
    }

    isEnabled() {
        return this.animationsEnabled && !this.prefersReducedMotion;
    }

    refresh() {
        // Re-observe all elements (useful after page content changes)
        if (this.animationsEnabled && this.observer) {
            this.observeElements();
        }
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Initialize on load
let chaiScrollAnimations;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        chaiScrollAnimations = new ScrollAnimations();
        window.chaiScrollAnimations = chaiScrollAnimations;
    });
} else {
    chaiScrollAnimations = new ScrollAnimations();
    window.chaiScrollAnimations = chaiScrollAnimations;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollAnimations;
}
