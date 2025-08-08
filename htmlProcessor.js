// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 AI Assistant & User Collaborator
// HTML Processing Module - Inspired by WeatherPack's robust HTML rendering

/**
 * Replaces complete HTML blocks with placeholders to prevent text processing interference
 * @param {string} text - The input text containing HTML
 * @param {string[]} htmlParts - Array to store the extracted HTML parts
 * @returns {string} Text with HTML blocks replaced by placeholders
 */
export function replaceHtmlBlocks(text, htmlParts) {
    let result = text;

    // Function to find the matching closing tag position
    function findMatchingClosingTag(text, startPos, tagName) {
        const openTag = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
        const closeTag = new RegExp(`<\\/${tagName}>`, 'gi');

        let openCount = 1;
        let pos = startPos;

        while (openCount > 0 && pos < text.length) {
            openTag.lastIndex = pos;
            closeTag.lastIndex = pos;

            const nextOpen = openTag.exec(text);
            const nextClose = closeTag.exec(text);

            if (!nextClose) break;

            if (!nextOpen || nextClose.index < nextOpen.index) {
                openCount--;
                pos = nextClose.index + nextClose[0].length;
            } else {
                openCount++;
                pos = nextOpen.index + nextOpen[0].length;
            }
        }

        return openCount === 0 ? pos : -1;
    }

    // Process from start to end
    let i = 0;
    while (i < result.length) {
        const tagMatch = result.slice(i).match(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/);
        if (!tagMatch) break;

        const fullTagMatch = tagMatch[0];
        const tagName = tagMatch[1];
        const tagStart = i + tagMatch.index;
        const tagEnd = tagStart + fullTagMatch.length;

        // Check if it's a self-closing tag
        if (fullTagMatch.endsWith('/>')) {
            htmlParts.push(fullTagMatch);
            result = result.slice(0, tagStart) + `<!--EMBER_HTML_PLACEHOLDER_${htmlParts.length - 1}-->` + result.slice(tagEnd);
            i = tagStart + `<!--EMBER_HTML_PLACEHOLDER_${htmlParts.length - 1}-->`.length;
            continue;
        }

        // Check if it's a void element (no closing tag needed)
        if (/^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i.test(tagName)) {
            htmlParts.push(fullTagMatch);
            result = result.slice(0, tagStart) + `<!--EMBER_HTML_PLACEHOLDER_${htmlParts.length - 1}-->` + result.slice(tagEnd);
            i = tagStart + `<!--EMBER_HTML_PLACEHOLDER_${htmlParts.length - 1}-->`.length;
            continue;
        }

        // Find matching closing tag
        const closingPos = findMatchingClosingTag(result, tagEnd, tagName);
        if (closingPos > 0) {
            const fullBlock = result.slice(tagStart, closingPos);
            htmlParts.push(fullBlock);
            result = result.slice(0, tagStart) + `<!--EMBER_HTML_PLACEHOLDER_${htmlParts.length - 1}-->` + result.slice(closingPos);
            i = tagStart + `<!--EMBER_HTML_PLACEHOLDER_${htmlParts.length - 1}-->`.length;
        } else {
            i = tagEnd;
        }
    }

    return result;
}

/**
 * Post-processes message content by preserving HTML blocks and only applying
 * SillyTavern's text formatting to plain text segments
 * @param {number} messageId - The message ID
 * @param {string} characterName - Character name for formatting
 * @param {string} text - The message text to process
 * @param {Function} messageFormattingFunction - SillyTavern's messageFormatting function
 * @returns {string} Processed text with HTML preserved
 */
export function postProcessMessage(messageId, characterName, text, messageFormattingFunction) {
    console.log(`[Ember HTML Processor] Processing message ${messageId} with enhanced HTML preservation`);
    
    const htmlParts = [];
    
    // Replace HTML blocks with placeholders
    const textWithPlaceholders = replaceHtmlBlocks(text, htmlParts);
    console.log(`[Ember HTML Processor] Extracted ${htmlParts.length} HTML blocks`);

    const placeholderRegex = /(<!--EMBER_HTML_PLACEHOLDER_(\d+)-->)/g;
    let result = '';
    let lastIndex = 0;
    let match;

    // Iterate through the text, processing non-placeholder parts
    while ((match = placeholderRegex.exec(textWithPlaceholders)) !== null) {
        // Add the text before the current placeholder (apply text formatting)
        const textBeforePlaceholder = textWithPlaceholders.substring(lastIndex, match.index);
        if (textBeforePlaceholder.length > 0) {
            console.log(`[Ember HTML Processor] Applying text formatting to segment: "${textBeforePlaceholder.substring(0, 50)}..."`);
            result += messageFormattingFunction(textBeforePlaceholder, characterName, false, false, messageId);
        }

        // Add the placeholder itself (will be replaced later)
        result += match[0];
        lastIndex = placeholderRegex.lastIndex;
    }

    // Add any remaining text after the last placeholder
    const remainingText = textWithPlaceholders.substring(lastIndex);
    if (remainingText.length > 0) {
        console.log(`[Ember HTML Processor] Applying text formatting to remaining text: "${remainingText.substring(0, 50)}..."`);
        result += messageFormattingFunction(remainingText, characterName, false, false, messageId);
    }

    // Replace placeholders with original HTML parts
    result = result.replace(/<!--EMBER_HTML_PLACEHOLDER_(\d+)-->/g, (_, index) => {
        const htmlIndex = parseInt(index, 10);
        if (htmlIndex >= 0 && htmlIndex < htmlParts.length) {
            console.log(`[Ember HTML Processor] Restoring HTML block ${htmlIndex}: "${htmlParts[htmlIndex].substring(0, 50)}..."`);
            return htmlParts[htmlIndex];
        }
        console.warn(`[Ember HTML Processor] Invalid HTML placeholder index: ${htmlIndex}`);
        return _;
    });

    console.log(`[Ember HTML Processor] Completed processing for message ${messageId}`);
    return result;
}

/**
 * Enhanced HTML detection that identifies various forms of HTML content
 * @param {string} content - Content to analyze
 * @returns {Object} Analysis results
 */
export function analyzeHtmlContent(content) {
    const hasHtmlTags = /<[a-zA-Z][^>]*>/i.test(content);
    const hasCompleteElements = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/i.test(content);
    const hasSelfClosingTags = /<[a-zA-Z][a-zA-Z0-9]*[^>]*\/>/i.test(content);
    const hasVoidElements = /<(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b[^>]*>/i.test(content);
    const hasHtmlEntities = /&(?:lt|gt|amp|quot|#x?[0-9a-fA-F]+);/.test(content);
    const hasScriptTags = /<script\b[^>]*>[\s\S]*?<\/script>/i.test(content);
    const hasStyleTags = /<style\b[^>]*>[\s\S]*?<\/style>/i.test(content);
    
    // Calculate HTML complexity score
    const htmlIndicators = [
        hasHtmlTags,
        hasCompleteElements, 
        hasSelfClosingTags,
        hasVoidElements,
        hasHtmlEntities,
        hasScriptTags,
        hasStyleTags
    ];
    
    const htmlScore = htmlIndicators.filter(Boolean).length;
    const isSignificantHtml = htmlScore >= 2 || hasCompleteElements || hasScriptTags;
    
    console.log(`[Ember HTML Analyzer] Content analysis - HTML score: ${htmlScore}/7, Significant: ${isSignificantHtml}`);
    
    return {
        isHtml: hasHtmlTags,
        isSignificantHtml,
        hasCompleteElements,
        hasScriptTags,
        hasStyleTags,
        hasSelfClosingTags,
        hasVoidElements,
        hasHtmlEntities,
        htmlScore
    };
}

/**
 * Safe HTML parsing and content extraction
 * @param {string} htmlContent - HTML content to parse
 * @returns {Object} Parsed content information
 */
export function safeParseHtml(htmlContent) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const scripts = doc.querySelectorAll('script');
        const styles = doc.querySelectorAll('style');
        const links = doc.querySelectorAll('link');
        const images = doc.querySelectorAll('img');
        const forms = doc.querySelectorAll('form');
        const inputs = doc.querySelectorAll('input, button, select, textarea');
        
        return {
            success: true,
            document: doc,
            stats: {
                scripts: scripts.length,
                styles: styles.length,
                links: links.length,
                images: images.length,
                forms: forms.length,
                inputs: inputs.length
            },
            elements: {
                scripts: Array.from(scripts),
                styles: Array.from(styles),
                links: Array.from(links),
                images: Array.from(images),
                forms: Array.from(forms),
                inputs: Array.from(inputs)
            }
        };
    } catch (error) {
        console.error('[Ember HTML Parser] Parse error:', error);
        return {
            success: false,
            error: error.message,
            document: null,
            stats: null,
            elements: null
        };
    }
}

/**
 * Extract content blocks for preservation during processing
 * @param {string} text - Text to process
 * @returns {Object} Processed text and extracted blocks
 */
export function extractPreservableContent(text) {
    const blocks = {
        codeBlocks: [],
        htmlBlocks: [],
        scriptBlocks: [],
        preservedRegions: []
    };
    
    let result = text;
    
    // Extract fenced code blocks first
    result = result.replace(/(```[\s\S]*?```)/g, (match) => {
        blocks.codeBlocks.push(match);
        return `<!--EMBER_CODE_BLOCK_${blocks.codeBlocks.length - 1}-->`;
    });
    
    // Extract inline code
    result = result.replace(/(`[^`\n]*?`)/g, (match) => {
        blocks.preservedRegions.push(match);
        return `<!--EMBER_INLINE_CODE_${blocks.preservedRegions.length - 1}-->`;
    });
    
    // Extract HTML blocks using our robust system
    const htmlParts = [];
    result = replaceHtmlBlocks(result, htmlParts);
    blocks.htmlBlocks = htmlParts;
    
    return {
        processedText: result,
        blocks
    };
}

/**
 * Restore all extracted content blocks
 * @param {string} text - Text with placeholders
 * @param {Object} blocks - Extracted blocks to restore
 * @returns {string} Text with restored content
 */
export function restorePreservableContent(text, blocks) {
    let result = text;
    
    // Restore code blocks
    result = result.replace(/<!--EMBER_CODE_BLOCK_(\d+)-->/g, (_, index) => {
        const blockIndex = parseInt(index, 10);
        return blocks.codeBlocks[blockIndex] || _;
    });
    
    // Restore inline code
    result = result.replace(/<!--EMBER_INLINE_CODE_(\d+)-->/g, (_, index) => {
        const blockIndex = parseInt(index, 10);
        return blocks.preservedRegions[blockIndex] || _;
    });
    
    // Restore HTML blocks
    result = result.replace(/<!--EMBER_HTML_PLACEHOLDER_(\d+)-->/g, (_, index) => {
        const blockIndex = parseInt(index, 10);
        return blocks.htmlBlocks[blockIndex] || _;
    });
    
    return result;
}

/**
 * Self-test function to validate the HTML processing system
 */
export function testHtmlProcessing() {
    console.log('[Ember HTML Processor] Running self-tests...');
    
    // Test 1: Basic HTML preservation
    const testHtml1 = '<div class="test">Hello <span style="color: red">world</span></div> and some plain text';
    const htmlParts1 = [];
    const result1 = replaceHtmlBlocks(testHtml1, htmlParts1);
    const restored1 = result1.replace(/<!--EMBER_HTML_PLACEHOLDER_(\d+)-->/g, (_, index) => htmlParts1[parseInt(index, 10)]);
    console.log('[Test 1] HTML preservation:', restored1 === testHtml1 ? 'PASS' : 'FAIL');
    
    // Test 2: Nested elements
    const testHtml2 = '<div><p>Nested <strong>content</strong></p></div>';
    const htmlParts2 = [];
    const result2 = replaceHtmlBlocks(testHtml2, htmlParts2);
    const restored2 = result2.replace(/<!--EMBER_HTML_PLACEHOLDER_(\d+)-->/g, (_, index) => htmlParts2[parseInt(index, 10)]);
    console.log('[Test 2] Nested elements:', restored2 === testHtml2 ? 'PASS' : 'FAIL');
    
    // Test 3: Self-closing tags
    const testHtml3 = 'Before <img src="test.jpg" alt="test"/> after';
    const htmlParts3 = [];
    const result3 = replaceHtmlBlocks(testHtml3, htmlParts3);
    const restored3 = result3.replace(/<!--EMBER_HTML_PLACEHOLDER_(\d+)-->/g, (_, index) => htmlParts3[parseInt(index, 10)]);
    console.log('[Test 3] Self-closing tags:', restored3 === testHtml3 ? 'PASS' : 'FAIL');
    
    // Test 4: Content analysis
    const htmlContent = '<div class="complex"><script>alert("test")</script><style>body{color:red}</style></div>';
    const analysis = analyzeHtmlContent(htmlContent);
    console.log('[Test 4] Content analysis:', analysis.isSignificantHtml && analysis.hasScriptTags && analysis.hasStyleTags ? 'PASS' : 'FAIL');
    
    console.log('[Ember HTML Processor] Self-tests completed');
}