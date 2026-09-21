import { nextId } from './calculations';

export function blankPOItem() {
  return {
    id: nextId('po'),
    sku: '',
    itemCode: '',
    description: '',
    specification: '',
    length: '',
    width: '',
    thickness: '',
    qty: '1',
    unit: 'No',
    unitPrice: '',
    discount: '0',
    gstPercent: '18',
  };
}

export function blankQuoteItem() {
  return {
    id: nextId('qt'),
    description: '',
    sizeThickness: '',
    qty: '1',
    unit: 'No',
    rate: '',
  };
}

export function blankVendor() {
  return {
    companyName: '',
    contactPerson: '',
    gst: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
  };
}

export function initialPOData() {
  return {
    poNumber: '',
    poDate: '',
    refQuoteNumber: '',
    refDate: '',
    subject: '',
    preparedBy: '',
    vendor: blankVendor(),
    introText:
      'With reference to your quotation, we are pleased to place the purchase order as per the below-mentioned details.',
    items: [blankPOItem()],
    interState: false,
    delivery: {
      address: '',
      date: '',
      mode: '',
      expectedDelivery: '',
    },
    payment: {
      terms: '',
      advancePercent: '',
      creditDays: '',
      bankDetails: '',
    },
    terms: [
      'Prices are inclusive of packing & forwarding unless stated otherwise.',
      'GST shall be charged extra as applicable.',
      'Any deviation from the above specification shall be subject to mutual discussion and approval.',
    ],
    notes: '',
    signatures: {
      preparedBy: '',
      checkedBy: '',
      approvedBy: '',
    },
  };
}

export function initialQuoteData() {
  return {
    quotationNumber: '',
    quotationDate: '',
    validity: '7 days from the date of issue',
    deliveryTime: '',
    subject: '',
    preparedBy: '',
    vendor: blankVendor(),
    introText:
      'We thank you for your valuable enquiry and are pleased to submit our quotation as per your requirements.',
    items: [blankQuoteItem()],
    gstPercent: 18,
    technicalDetails: [],
    paymentTerms: '',
    terms: [
      'This quotation shall remain valid for the period stated above.',
      'GST @ 18% shall be charged extra as applicable.',
      'Transportation charges, if any, shall be billed extra.',
    ],
    notes: '',
    signatures: {
      preparedBy: '',
      checkedBy: '',
      approvedBy: '',
    },
  };
}
