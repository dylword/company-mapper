# Address fidelity change — 2026-05-13

Scope: `src/components/GraphCanvas.tsx` only.

Goal: address nodes show the **full** address (premises → country) instead of
just `address_line_1, locality`, and the "expand at this address" search uses
the full string. Dedup of address nodes still merges records that point at the
same premises but have slightly different Companies House formatting, by
matching on a normalised key rather than on the display label.

If something downstream is broken by this and you need to revert, restore the
five hunks below verbatim.

---

## 1. `formatAddress` helper (~line 110)

### Now

```ts
const formatAddress = (addr: any) => {
    if (!addr) return undefined;
    return [
        addr.premises,
        addr.address_line_1,
        addr.address_line_2,
        addr.locality,
        addr.region,
        addr.postal_code,
        addr.country
    ].filter(Boolean).join(', ');
};

// Normalised key for address dedup — tolerates punctuation/whitespace/case
// differences between Companies House records for the same premises.
const normalizeAddressKey = (addr: any) => {
    if (!addr) return '';
    return [
        addr.premises,
        addr.address_line_1,
        addr.address_line_2,
        addr.locality,
        addr.region,
        addr.postal_code,
        addr.country
    ]
        .filter(Boolean)
        .map((s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''))
        .join('|');
};
```

### Before

```ts
const formatAddress = (addr: any) => {
    if (!addr) return undefined;
    return [
        addr.address_line_1,
        addr.address_line_2,
        addr.locality,
        addr.region,
        addr.postal_code,
        addr.country
    ].filter(Boolean).join(', ');
};
```

To revert: delete `normalizeAddressKey` entirely and drop `addr.premises` from
`formatAddress`.

---

## 2. Initial officer correspondence address block (~line 205)

### Now

```ts
officers.forEach((officer: any, index: number) => {
    if (officer.address) {
        const addressLabel = formatAddress(officer.address);
        if (!addressLabel) return;

        const addressKey = normalizeAddressKey(officer.address);
        const officerId = `officer-${officer.officer_id || index}`;

        let addressNodeId: string;
        const foundNode = officerAddressNodes.find(n => n.data.addressKey === addressKey);
        const companyAddressKey = normalizeAddressKey(company.registered_office_address);

        if (foundNode) {
            addressNodeId = foundNode.id;
        } else if (addressKey && addressKey === companyAddressKey) {
            // Same premises as the registered office — reuse that node.
            addressNodeId = 'address-1';
        } else {
            addressNodeId = `address-${index}-${officer.officer_id || index}`;
            officerAddressNodes.push({
                id: addressNodeId,
                type: 'businessCard',
                data: {
                    label: addressLabel,
                    role: 'Correspondence Address',
                    type: 'address',
                    addressKey,
                    source: { address: officer.address }
                },
                position: { x: 0, y: 0 },
            });
        }

        officerAddressEdges.push({ /* unchanged */ });
    }
});
```

### Before

```ts
officers.forEach((officer: any, index: number) => {
    if (officer.address) {
        const addressLabel = formatAddress(officer.address);
        if (!addressLabel) return;

        const officerId = `officer-${officer.officer_id || index}`;
        const addressId = `addr-${officerId}`; // Unique ID for this specific officer's address node instance?
        // Or should we deduplicate addresses?
        // "sit tightly and just under the director node" suggests a dedicated node per director might be better for layout
        // unless we want to show shared addresses.
        // Let's deduplicate by address string to show connections, but for layout "tightly under" might be tricky if shared.
        // Let's try deduplicating first as that's more "graph-like".

        // Actually, to ensure it sits "tightly under", maybe we treat it as a child?
        // But we are using a flat graph.
        // Let's stick to standard nodes for now.

        const existingAddressNode = officerAddressNodes.find(n => n.data.label === addressLabel) ||
            (addressLabel === formatAddress(company.registered_office_address) ? companyNode : null); // Check if matches company address? No, companyNode is a company.

        // Let's just make a new address node if it doesn't exist in our list
        let addressNodeId = `address-${addressLabel.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}-${index}`; // simple ID generation

        // Better ID strategy: hash or just use the label if unique enough?
        // Let's use a prefix and simple check.
        const foundNode = officerAddressNodes.find(n => n.data.label === addressLabel);

        if (foundNode) {
            addressNodeId = foundNode.id;
        } else {
            // Check if it matches the main company address?
            const companyAddressLabel = formatAddress(company.registered_office_address);
            if (addressLabel === companyAddressLabel) {
                // If it matches company address, do we link to the existing company address node?
                // The existing code creates 'address-1' for company address.
                addressNodeId = 'address-1';
            } else {
                addressNodeId = `address-${index}-${officer.officer_id || index}`; // Unique per officer for now to ensure "tightly under"?
                // No, user said "same sidebar/ expand connection functionality like normal company addresses"
                // So it should be a proper address node.

                // Let's try to deduplicate globally if possible, but for now let's just add it.
                officerAddressNodes.push({
                    id: addressNodeId,
                    type: 'businessCard',
                    data: {
                        label: addressLabel,
                        role: 'Correspondence Address',
                        type: 'address',
                        source: { address: officer.address } // Mock source
                    },
                    position: { x: 0, y: 0 },
                });
            }
        }
```

---

## 3. Registered-office address node (~line 295)

### Now

```ts
const addressNode: Node = {
    id: 'address-1',
    type: 'businessCard',
    data: {
        label: formatAddress(company.registered_office_address),
        role: 'Registered Address',
        type: 'address',
        addressKey: normalizeAddressKey(company.registered_office_address),
        source: company
    },
    position: { x: 0, y: 0 },
};
```

### Before

```ts
const addressNode: Node = {
    id: 'address-1',
    type: 'businessCard',
    data: {
        label: [company.registered_office_address.address_line_1, company.registered_office_address.locality].filter(Boolean).join(', '),
        role: 'Registered Address',
        type: 'address',
        source: company // Store company as source for address
    },
    position: { x: 0, y: 0 },
};
```

---

## 4. Officer-expansion address linking (~line 670) and the company-row `address` field (~line 701)

### Now

```ts
// Address Linking
let addressEdge: Edge | null = null;
const itemAddress = item.address;
if (itemAddress) {
    const addressKey = normalizeAddressKey(itemAddress);
    const existingAddressNode = currentNodes.find(n => n.data.type === 'address' && n.data.addressKey === addressKey);
    if (existingAddressNode) {
        addressEdge = { /* unchanged */ };
    }
}

// ...
address: company ? formatAddress(company.registered_office_address) : formatAddress(itemAddress),
```

### Before

```ts
// Address Linking
let addressEdge: Edge | null = null;
const itemAddress = item.address;
if (itemAddress) {
    const addressLabel = [itemAddress.address_line_1, itemAddress.locality].filter(Boolean).join(', ');
    const existingAddressNode = currentNodes.find(n => n.data.type === 'address' && n.data.label === addressLabel);
    if (existingAddressNode) {
        addressEdge = { /* unchanged */ };
    }
}

// ...
address: company ? formatAddress(company.registered_office_address) : (itemAddress ? [itemAddress.address_line_1, itemAddress.locality].filter(Boolean).join(', ') : undefined),
```

---

## 5. New-officer correspondence address block (~line 795)

### Now

```ts
if (officer.address) {
    const addressLabel = formatAddress(officer.address);
    if (addressLabel) {
        const addressKey = normalizeAddressKey(officer.address);
        let addressNodeId = `address-${addressKey.slice(0, 32) || index}-${index}`;

        const existingAddress = currentNodes.find(n => n.data.type === 'address' && n.data.addressKey === addressKey);
        if (existingAddress) {
            addressNodeId = existingAddress.id;
        } else {
            const newAddress = newNodes.find(n => n.data.type === 'address' && n.data.addressKey === addressKey);
            if (newAddress) {
                addressNodeId = newAddress.id;
            } else {
                const newAddressNode: Node = {
                    id: addressNodeId,
                    type: 'businessCard',
                    data: {
                        label: addressLabel,
                        role: 'Correspondence Address',
                        type: 'address',
                        addressKey,
                        source: { address: officer.address }
                    },
                    position: { x: 0, y: 0 },
                };
                newNodes.push(newAddressNode);
                allNeighbors.push(newAddressNode);
            }
        }
        // newEdges.push({...}) unchanged
    }
}
```

### Before

```ts
if (officer.address) {
    const addressLabel = formatAddress(officer.address);
    if (addressLabel) {
        // Check if address node already exists in currentNodes or newNodes
        let addressNodeId = `address-${addressLabel.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}-${index}`;

        // Simple dedupe check against current graph
        const existingAddress = currentNodes.find(n => n.data.type === 'address' && n.data.label === addressLabel);
        if (existingAddress) {
            addressNodeId = existingAddress.id;
        } else {
            // Check newNodes
            const newAddress = newNodes.find(n => n.data.type === 'address' && n.data.label === addressLabel);
            if (newAddress) {
                addressNodeId = newAddress.id;
            } else {
                // Create new address node
                const newAddressNode: Node = {
                    id: addressNodeId,
                    type: 'businessCard',
                    data: {
                        label: addressLabel,
                        role: 'Correspondence Address',
                        type: 'address',
                        source: { address: officer.address }
                    },
                    position: { x: 0, y: 0 },
                };
                newNodes.push(newAddressNode);
                allNeighbors.push(newAddressNode);
            }
        }
        // newEdges.push({...}) unchanged
    }
}
```

---

## Risk recap

- The `?location=` parameter on `/advanced-search/companies` is loose, but
  now receives the full address string from the (full) node label via
  `nodeToExpand.data.label` at the `type === 'address'` branch. If CH stores
  a premises differently than the officer record does, the search may return
  fewer hits than the old truncated `line_1, locality` form.
- Dedup is now keyed on a stripped lowercase concat. If two genuinely
  different premises share every alphanumeric character (extremely unusual),
  they will merge. Adding `addr.premises` to the key reduces that risk
  versus the prior label-equality check.

## How to revert

Restore the five "Before" blocks above. `normalizeAddressKey` should be
deleted entirely. No other files need changes.
