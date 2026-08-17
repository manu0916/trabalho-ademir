export const EMPTY_CUSTOMER_ADDRESS = Object.freeze({
  label: 'Casa',
  postalCode: '',
  state: '',
  city: '',
  neighborhood: '',
  street: '',
  addressNumber: '',
  complement: '',
  isDefault: false,
});

export const onlyDigits = (value = '') => String(value).replace(/\D/g, '');

export const formatCep = (value = '') => {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export function addressToForm(address = {}) {
  return {
    ...EMPTY_CUSTOMER_ADDRESS,
    ...address,
    postalCode: onlyDigits(address.postalCode).slice(0, 8),
    isDefault: Boolean(address.isDefault),
  };
}

export function addressPayload(address) {
  return {
    label: String(address.label || '').trim(),
    postalCode: onlyDigits(address.postalCode).slice(0, 8),
    state: String(address.state || '').trim().toUpperCase(),
    city: String(address.city || '').trim(),
    neighborhood: String(address.neighborhood || '').trim(),
    street: String(address.street || '').trim(),
    addressNumber: String(address.addressNumber || '').trim(),
    complement: String(address.complement || '').trim(),
    isDefault: Boolean(address.isDefault),
  };
}

export function isAddressComplete(address, requireLabel = true) {
  const value = addressPayload(address);
  return (!requireLabel || value.label.length > 0)
    && value.postalCode.length === 8
    && value.state.length === 2
    && value.city.length > 0
    && value.neighborhood.length > 0
    && value.street.length > 0
    && value.addressNumber.length > 0;
}
