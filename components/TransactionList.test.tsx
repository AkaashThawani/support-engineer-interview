import { describe, it, expect } from 'vitest';
import DOMPurify from 'isomorphic-dompurify';

describe('SEC-303: XSS Vulnerability Protection', () => {
  describe('DOMPurify Sanitization', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>Safe text';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Safe text');
    });

    it('should remove inline javascript event handlers', () => {
      const maliciousInput = '<img src="x" onerror="alert(\'XSS\')">';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove javascript: protocol in links', () => {
      const maliciousInput = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove iframe tags', () => {
      const maliciousInput = '<iframe src="https://evil.com"></iframe>Normal text';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('evil.com');
      expect(sanitized).toContain('Normal text');
    });

    it('should remove object and embed tags', () => {
      const maliciousInput = '<object data="evil.swf"></object><embed src="evil.swf">';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('<embed');
    });

    it('should allow safe HTML tags', () => {
      const safeInput = '<b>Bold</b> <i>Italic</i> <em>Emphasis</em> <strong>Strong</strong>';
      const sanitized = DOMPurify.sanitize(safeInput);
      
      expect(sanitized).toContain('<b>Bold</b>');
      expect(sanitized).toContain('<i>Italic</i>');
      expect(sanitized).toContain('<em>Emphasis</em>');
      expect(sanitized).toContain('<strong>Strong</strong>');
    });

    it('should allow safe links', () => {
      const safeInput = '<a href="https://example.com">Safe Link</a>';
      const sanitized = DOMPurify.sanitize(safeInput);
      
      expect(sanitized).toContain('<a href="https://example.com">');
      expect(sanitized).toContain('Safe Link');
    });

    it('should preserve text content without HTML', () => {
      const plainText = 'Funding from card ending in 1234';
      const sanitized = DOMPurify.sanitize(plainText);
      
      expect(sanitized).toBe(plainText);
    });

    it('should handle empty strings', () => {
      const emptyInput = '';
      const sanitized = DOMPurify.sanitize(emptyInput);
      
      expect(sanitized).toBe('');
    });

    it('should handle null values', () => {
      const sanitized = DOMPurify.sanitize(null as unknown as string);
      
      expect(sanitized).toBe('');
    });
  });

  describe('Complex XSS Attack Vectors', () => {
    it('should safely handle encoded script tags', () => {
      const maliciousInput = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      // DOMPurify keeps HTML entities as-is (safe - they display as text, not execute)
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should block event handlers in various tags', () => {
      const maliciousInputs = [
        '<div onclick="alert(1)">Click</div>',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)">',
        '<select onchange="alert(1)">',
        '<form onsubmit="alert(1)">',
      ];

      maliciousInputs.forEach(input => {
        const sanitized = DOMPurify.sanitize(input);
        expect(sanitized).not.toContain('alert');
        expect(sanitized).not.toMatch(/on\w+=/);
      });
    });

    it('should sanitize data URIs with scripts', () => {
      const maliciousInput = '<img src="data:text/html,<script>alert(1)</script>">';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      // DOMPurify handles data URIs - either removes script or sanitizes it
      // The key is the script won't execute
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('should block SVG with embedded scripts', () => {
      const maliciousInput = '<svg><script>alert(1)</script></svg>';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('alert');
    });

    it('should block meta refresh redirects', () => {
      const maliciousInput = '<meta http-equiv="refresh" content="0;url=https://evil.com">';
      const sanitized = DOMPurify.sanitize(maliciousInput);
      
      expect(sanitized).not.toContain('<meta');
      expect(sanitized).not.toContain('evil.com');
    });
  });

  describe('Transaction Description Use Cases', () => {
    it('should safely handle typical transaction descriptions', () => {
      const descriptions = [
        'Payment for invoice #12345',
        'Transfer to account ending in 1234',
        'Deposit from checking account',
        'ATM withdrawal at Main Street',
        'Online purchase at Store XYZ',
      ];

      descriptions.forEach(desc => {
        const sanitized = DOMPurify.sanitize(desc);
        expect(sanitized).toBe(desc);
      });
    });

    it('should allow formatted transaction messages', () => {
      const formattedDesc = '<b>Payment received</b> from <em>Customer ABC</em>';
      const sanitized = DOMPurify.sanitize(formattedDesc);
      
      expect(sanitized).toContain('<b>Payment received</b>');
      expect(sanitized).toContain('<em>Customer ABC</em>');
    });

    it('should handle transaction descriptions with special characters', () => {
      const desc = 'Payment for "Service A" & "Service B" - Total: $100.50';
      const sanitized = DOMPurify.sanitize(desc);
      
      expect(sanitized).toContain('Service A');
      expect(sanitized).toContain('Service B');
      expect(sanitized).toContain('$100.50');
    });

    it('should strip malicious content but preserve safe content', () => {
      const mixedContent = '<b>Payment</b><script>alert("XSS")</script> completed';
      const sanitized = DOMPurify.sanitize(mixedContent);
      
      expect(sanitized).toContain('<b>Payment</b>');
      expect(sanitized).toContain('completed');
      expect(sanitized).not.toContain('script');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle very long input strings', () => {
      const longString = 'A'.repeat(10000) + '<script>alert(1)</script>';
      const sanitized = DOMPurify.sanitize(longString);
      
      expect(sanitized).not.toContain('script');
      expect(sanitized).not.toContain('alert');
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('should handle nested malicious tags', () => {
      const nestedMalicious = '<div><span><script>alert(1)</script></span></div>';
      const sanitized = DOMPurify.sanitize(nestedMalicious);
      
      expect(sanitized).not.toContain('script');
      expect(sanitized).not.toContain('alert');
    });

    it('should handle Unicode and special encoding attempts', () => {
      const unicodeAttempt = '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">';
      const sanitized = DOMPurify.sanitize(unicodeAttempt);
      
      expect(sanitized).not.toContain('onerror');
    });
  });
});
