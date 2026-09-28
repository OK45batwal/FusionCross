use std::fs::File;
use std::io::Read;
use std::path::Path;

/// Extract the primary embedded icon from a Windows PE executable (.exe)
/// and return it as a base64 Data URL (`data:image/png;base64,...` or `data:image/x-icon;base64,...`).
pub fn extract_icon_data_url(exe_path: &Path) -> Option<String> {
    let mut file = File::open(exe_path).ok()?;
    let mut data = Vec::new();
    file.read_to_end(&mut data).ok()?;

    let (raw_icon, is_png) = extract_raw_icon(&data)?;

    let (mime, final_bytes) = if is_png {
        ("image/png", raw_icon)
    } else {
        // Construct valid ICO container for raw DIB / BMP icon bytes
        let mut ico = Vec::with_capacity(22 + raw_icon.len());
        // ICONDIR
        ico.extend_from_slice(&[0, 0]); // Reserved
        ico.extend_from_slice(&[1, 0]); // Type 1 (Icon)
        ico.extend_from_slice(&[1, 0]); // 1 image
                                        // ICONDIRENTRY (16 bytes)
        ico.push(0); // width (0 = 256)
        ico.push(0); // height (0 = 256)
        ico.push(0); // color count
        ico.push(0); // reserved
        ico.extend_from_slice(&[1, 0]); // planes (1)
        ico.extend_from_slice(&[32, 0]); // bit count (32 bpp)
        ico.extend_from_slice(&(raw_icon.len() as u32).to_le_bytes()); // dwBytesInRes
        ico.extend_from_slice(&22u32.to_le_bytes()); // dwImageOffset (22)
                                                     // Image data
        ico.extend_from_slice(&raw_icon);
        ("image/x-icon", ico)
    };

    let b64 = base64_encode(&final_bytes);
    Some(format!("data:{mime};base64,{b64}"))
}

fn extract_raw_icon(data: &[u8]) -> Option<(Vec<u8>, bool)> {
    if data.len() < 64 || &data[..2] != b"MZ" {
        return None;
    }
    let pe_off = read_u32(data, 60)? as usize;
    if pe_off + 24 > data.len() || &data[pe_off..pe_off + 4] != b"PE\0\0" {
        return None;
    }

    let num_sections = read_u16(data, pe_off + 6)? as usize;
    let opt_size = read_u16(data, pe_off + 20)? as usize;
    let opt_header = pe_off + 24;
    let magic = read_u16(data, opt_header)?;

    let data_dir_off = opt_header + if magic == 0x20b { 112 } else { 96 };
    // Entry 2 is IMAGE_DIRECTORY_ENTRY_RESOURCE
    let res_va = read_u32(data, data_dir_off + 16)?;
    let res_size = read_u32(data, data_dir_off + 20)?;
    if res_va == 0 || res_size == 0 {
        return None;
    }

    let sec_headers = opt_header + opt_size;
    let mut sections = Vec::with_capacity(num_sections);
    for i in 0..num_sections {
        let sh = sec_headers + i * 40;
        if sh + 40 > data.len() {
            break;
        }
        let vsize = read_u32(data, sh + 8)?;
        let va = read_u32(data, sh + 12)?;
        let rsize = read_u32(data, sh + 16)?;
        let rptr = read_u32(data, sh + 20)?;
        sections.push((va, vsize, rptr, rsize));
    }

    let rva_to_off = |rva: u32| -> Option<usize> {
        for &(va, vs, rp, rs) in &sections {
            let max_size = vs.max(rs);
            if rva >= va && rva < va.saturating_add(max_size) {
                let delta = (rva - va) as usize;
                return (rp as usize).checked_add(delta);
            }
        }
        None
    };

    let res_base = rva_to_off(res_va)?;

    let parse_dir = |off: usize| -> Option<Vec<(u32, u32)>> {
        if off + 16 > data.len() {
            return None;
        }
        let named = read_u16(data, off + 12)? as usize;
        let ids = read_u16(data, off + 14)? as usize;
        let count = named + ids;
        let mut entries = Vec::with_capacity(count);
        for i in 0..count {
            let e_off = off + 16 + i * 8;
            if e_off + 8 > data.len() {
                break;
            }
            let eid = read_u32(data, e_off)?;
            let eoffset = read_u32(data, e_off + 4)?;
            entries.push((eid, eoffset));
        }
        Some(entries)
    };

    let type_entries = parse_dir(res_base)?;
    let grp_entry = type_entries.iter().find(|e| e.0 == 14)?; // RT_GROUP_ICON
    let icon_entry = type_entries.iter().find(|e| e.0 == 3)?; // RT_ICON

    let grp_dir = parse_dir(res_base + (grp_entry.1 & 0x7FFFFFFF) as usize)?;
    let first_grp = grp_dir.first()?;
    let grp_langs = parse_dir(res_base + (first_grp.1 & 0x7FFFFFFF) as usize)?;
    let first_lang = grp_langs.first()?;
    let data_desc_off = res_base + (first_lang.1 as usize);
    let g_rva = read_u32(data, data_desc_off)?;
    let g_off = rva_to_off(g_rva)?;

    // Parse GRPICONDIR to find the highest resolution icon ID
    let g_count = read_u16(data, g_off + 4)? as usize;
    let mut best_id = 0u16;
    let mut best_w = -1i32;

    for i in 0..g_count {
        let entry_off = g_off + 6 + i * 14;
        if entry_off + 14 > data.len() {
            break;
        }
        let w = data[entry_off];
        let nid = read_u16(data, entry_off + 12)?;
        let eff_w = if w == 0 { 256 } else { w as i32 };
        if eff_w > best_w {
            best_w = eff_w;
            best_id = nid;
        }
    }

    if best_id == 0 {
        return None;
    }

    // Lookup best_id in RT_ICON directory
    let ic_dir = parse_dir(res_base + (icon_entry.1 & 0x7FFFFFFF) as usize)?;
    let matched_ic = ic_dir
        .iter()
        .find(|e| e.0 == best_id as u32)
        .or_else(|| ic_dir.first())?;

    let ic_langs = parse_dir(res_base + (matched_ic.1 & 0x7FFFFFFF) as usize)?;
    let first_ic_lang = ic_langs.first()?;
    let ic_desc_off = res_base + (first_ic_lang.1 as usize);
    let ic_rva = read_u32(data, ic_desc_off)?;
    let ic_size = read_u32(data, ic_desc_off + 4)? as usize;
    let ic_off = rva_to_off(ic_rva)?;

    if ic_off + ic_size > data.len() || ic_size == 0 {
        return None;
    }

    let raw = data[ic_off..ic_off + ic_size].to_vec();
    let is_png = raw.len() >= 8 && &raw[..8] == b"\x89PNG\r\n\x1a\n";
    Some((raw, is_png))
}

fn read_u16(data: &[u8], off: usize) -> Option<u16> {
    if off + 2 <= data.len() {
        Some(u16::from_le_bytes([data[off], data[off + 1]]))
    } else {
        None
    }
}

fn read_u32(data: &[u8], off: usize) -> Option<u32> {
    if off + 4 <= data.len() {
        Some(u32::from_le_bytes([
            data[off],
            data[off + 1],
            data[off + 2],
            data[off + 3],
        ]))
    } else {
        None
    }
}

const BASE64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64_encode(input: &[u8]) -> String {
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 {
            chunk[1] as usize
        } else {
            0
        };
        let b2 = if chunk.len() > 2 {
            chunk[2] as usize
        } else {
            0
        };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(BASE64_CHARS[(triple >> 18) & 0x3F] as char);
        out.push(BASE64_CHARS[(triple >> 12) & 0x3F] as char);
        if chunk.len() > 1 {
            out.push(BASE64_CHARS[(triple >> 6) & 0x3F] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(BASE64_CHARS[triple & 0x3F] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_encodes_correctly() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
    }

    #[test]
    fn rejects_non_pe() {
        let fake = vec![0u8; 100];
        assert!(extract_raw_icon(&fake).is_none());
    }
}
