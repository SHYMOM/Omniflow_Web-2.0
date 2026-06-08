/**
 * Utility to safely unpack JavaScript compressed with the standard P.A.C.K.E.R. obfuscator
 * eval(function(p,a,c,k,e,d){...})
 * 
 * Safely mimics the decompression routine without relying on malicious eval().
 */

export function detectAndUnpack(script: string): string {
    // Check if it matches the standard packer signature
    if (!script.includes('eval(function(p,a,c,k,e,d)')) {
        return script; // Return original if not packed
    }

    // Extract the arguments passed to the packer function
    // Typical format: }('payload', radix, count, 'word1|word2'.split('|'), 0, {}))
    const regex = /}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(['"]\|['"]\)/;
    const match = script.match(regex);

    if (!match) {
        console.warn("Found P.A.C.K.E.R. signature but failed to parse arguments.");
        return script;
    }

    const quoteType = match[1];
    let p = match[2];
    const a = parseInt(match[3], 10);
    const c = parseInt(match[4], 10);
    const k = match[6].split('|');

    // Unescape the payload string based on the surrounding quote type
    if (quoteType === "'") {
        p = p.replace(/\\'/g, "'");
    } else {
        p = p.replace(/\\"/g, '"');
    }
    p = p.replace(/\\\\/g, "\\");

    let unpacked = p;

    // Unpack logic: replace base-encoded occurrences with original dictionary words
    for (let i = c - 1; i >= 0; i--) {
        if (k[i]) {
            const encodedWord = intToBase(i, a);
            // \b is safe here because encodedWord only contains alphanumeric characters (base36/62)
            const wordRegex = new RegExp(`\\b${encodedWord}\\b`, 'g');
            unpacked = unpacked.replace(wordRegex, k[i]);
        }
    }

    // Return the unpacked string (unescaping forward slashes commonly found in URLs)
    return unpacked.replace(/\\\//g, '/');
}

/**
 * Replicates the custom base conversion 'e(c)' function from standard P.A.C.K.E.R.
 * Supports up to Base62 encoding standardly used.
 */
function intToBase(num: number, radix: number): string {
    const encode = (c: number): string => {
        let result = '';
        if (c < radix) {
            result = c > 35 ? String.fromCharCode(c + 29) : c.toString(36);
        } else {
            result = encode(Math.floor(c / radix)) + (c % radix > 35 ? String.fromCharCode((c % radix) + 29) : (c % radix).toString(36));
        }
        return result;
    };
    return encode(num);
}
