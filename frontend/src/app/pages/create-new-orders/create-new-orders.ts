import { CommonModule } from '@angular/common';
import {ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardLayoutService } from '../../layout/dashboard-layout.service';
import { LocalOrdersService } from '../../shared/local-orders/local-orders.service';
import { LocalProductesService } from '../../shared/local-product/local-productes.service';
import { CreateOrderPayload } from '../../models/order.model';
import { ProductRecord, normalizeProduct,} from '../../models/product.model';
import { LocalCustomersService } from '../../shared/local-customers/local-customers.service';
import { CustomerRecord } from '../../models/customer.model';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast';
import { ModalComponent } from '../../layout/modal/modal';
@Component({
  selector: 'app-new-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './create-new-orders.html',
  styleUrls: ['./create-new-orders.css'],
})
export class NewOrdersComponent implements OnInit {
  pendingOrders = signal<CreateOrderPayload[]>([]);
  isSubmitting = signal(false);
  // ==============================
// Customer
// ==============================
customerName = signal('');
phone = signal('');
address = signal('');
foundCustomers = signal<CustomerRecord[]>([]);
  selectedCustomer = signal<CustomerRecord | null>(null);
  isWalkInCustomer = signal(false);
  isLoadingWalkInCustomer = signal(false);
// ============================================
// ✅ Validation Error Messages
// ============================================
readonly customerNameError = signal('');
readonly phoneError = signal('');
readonly productError = signal('');

// ==============================
// Product
// ==============================
products = signal<ProductRecord[]>([]);
productId = signal<number | null>(null);

size = signal('');
price = signal(0);
quantity = signal(1);
totalPrice = signal(0);

// ============================================
// ✅ Show Found Customers Card
// ============================================
showFoundCustomers = signal(false);
  showPhoneConfirmation = signal(false);
  phoneCustomer = signal<CustomerRecord | null>(null);

  onWalkInCustomerChange(enabled: boolean): void {
    this.isWalkInCustomer.set(enabled);
    this.foundCustomers.set([]);
    this.showFoundCustomers.set(false);
    this.showPhoneConfirmation.set(false);
    this.phoneCustomer.set(null);

    if (enabled) {
      this.loadWalkInCustomer();
      return;
    }

    this.selectedCustomer.set(null);
    this.customerName.set('');
    this.phone.set('');
    this.address.set('');
    this.clearValidationErrors();
  }


closeFoundCustomers(): void {
  this.showFoundCustomers.set(false);
  this.foundCustomers.set([]);
}



  private loadWalkInCustomer(): void {
    if (this.isLoadingWalkInCustomer()) return;
    this.isLoadingWalkInCustomer.set(true);

    this.localCustomersService.getOrCreateGeneralCustomer().subscribe({
      next: ({ data }) => {
        this.selectedCustomer.set(data);
        this.customerName.set(data.name);
        this.phone.set(data.phone);
        this.address.set(data.address ?? '');
        this.isLoadingWalkInCustomer.set(false);
      },
      error: (error) => {
        console.error('Failed to load walk-in customer', error);
        this.isWalkInCustomer.set(false);
        this.isLoadingWalkInCustomer.set(false);
       this.toastService.error('Failed to load walk-in customer. Please try again.');
      },
    });
  }

// ==============================
// UI State
// ==============================

ordersCount = signal(0);
  private readonly toastService = inject(ToastService);
  private readonly localCustomersService = inject(LocalCustomersService);
  private readonly layout = inject(DashboardLayoutService);
  private readonly localOrdersService = inject(LocalOrdersService);
  private readonly localProductsService = inject(LocalProductesService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  
  ngOnInit(): void {
    this.layout.setPageTitle('New Orders');

    this.localProductsService.getProducts().subscribe({
      next: (response) => {
        this.products.set(
                           response.map((product) => normalizeProduct(product))
                     );
        this.calculateTotal();
      },
      error: (error) => {
        console.error('Failed to load products', error);
      },
    });
  }

// ============================================
// ✅ Check Customer
// ============================================
checkCustomer(): void {
   
  const customerName = this.customerName().trim();
  const phone = this.phone().trim();

  // ============================================
// ✅ Validate Customer Name
// ============================================
if (!customerName) {

  this.customerNameError.set('Customer name is required.');

  return;

}

// ============================================
// ✅ Validate Phone Number
// ============================================
if (!phone) {

  this.phoneError.set('Phone number is required.');

  return;

}

  this.localCustomersService
    .checkCustomer(customerName, phone)
    .subscribe({

      next: (response) => {

         switch (response.status) {

    case 'FOUND_BY_PHONE':
      

  this.phoneCustomer.set(response.customer);

  this.showPhoneConfirmation.set(true);
  break;

    case 'FOUND_BY_NAME':

      this.foundCustomers.set(response.customers);

      this.showFoundCustomers.set(true);

      break;

   case 'NEW_CUSTOMER':
   this.registerCustomerAndAddOrder();

  break;

    default:

      console.warn('Unknown customer status.');

      break;

  }
      },

      error: (error) => {

        console.error('Check Customer Failed:', error);

      },

    });

}
// ============================================
// ✅ None Of These Customers
// ============================================
noneOfTheseCustomers(): void {

  this.showFoundCustomers.set(false);

  this.registerCustomer();

}
// ============================================
// ✅ Register New Customer
// ============================================
registerCustomer(): void {
  
  this.localCustomersService.registerCustomer({

    name: this.customerName().trim(),
    phone: this.phone().trim(),
    address: this.address().trim(),
    email: null,
    notes: '',
    category: 'temporary',
    hasAccount: 0,
    isArchived: 0,

  }).subscribe({

    next: (response) => {

      // Save the newly created customer
      this.selectedCustomer.set(response.data);

      // Customer is now selected
      console.log('Customer registered successfully.');

    },

    error: (error) => {

      console.error('Register Customer Failed:', error);

    }

  });

}
// ============================================
// ✅ Register Customer Then Create Order
// ============================================
registerCustomerAndAddOrder(): void {

  this.localCustomersService.registerCustomer({

    name: this.customerName().trim(),
    phone: this.phone().trim(),
    address: this.address().trim(),
    email: null,
    notes: '',
    category: 'temporary',
    hasAccount: 0,
    isArchived: 0,

  }).subscribe({

    next: (response) => {

      // Save the newly created customer
      this.selectedCustomer.set(response.data);

      // Keep the customer selected and add the current line to the list.
      this.addCurrentOrderToList();

    },

    error: (error) => {

      console.error('Register Customer Failed:', error);

    }

  });

}
// ============================================
// ✅ Select Customer
// ============================================
selectCustomer(customer: CustomerRecord): void {

  this.customerName.set(customer.name);
  this.phone.set(customer.phone);
  this.address.set(customer.address ?? '');

  this.selectedCustomer.set(customer);

  this.foundCustomers.set([]);
  this.showFoundCustomers.set(false);

}
// ============================================
// ✅ Confirm Phone Customer
// ============================================
// ============================================
// ✅ Confirm Phone Customer
// ============================================
confirmPhoneCustomer(): void {

  const customer = this.phoneCustomer();

  if (!customer) {
    return;
  }

  // Fill the form with the correct customer data
  this.customerName.set(customer.name);
  this.phone.set(customer.phone);
  this.address.set(customer.address ?? '');

  // Select customer
  this.selectedCustomer.set(customer);

  // Close dialog
  this.showPhoneConfirmation.set(false);

  // Clear temporary data
  this.phoneCustomer.set(null);

}
// ============================================
// ✅ Reject Phone Customer
// ============================================
rejectPhoneCustomer(): void {

  this.showPhoneConfirmation.set(false);

  this.phone.set('');

  this.phoneCustomer.set(null);

}

 // ======================================================
// Product Helpers
// ======================================================

/**
 * Returns the currently selected product.
 */
get selectedProduct(): ProductRecord | null {
  const productId = this.productId();

  if (productId === null) {
    return null;
  }

  return (
    this.products().find(
      (product) => Number(product.id) === productId
    ) ?? null
  );
}

/**
 * Converts any product id to a valid number.
 */
normalizeProductId(value: string | number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Calculates the order total.
 * Also loads the product price automatically
 * when the user selects a product.
 */
calculateTotal(): void {
  const quantity = Number(this.quantity());

  const safeQuantity =
    Number.isFinite(quantity) && quantity > 0
      ? quantity
      : 0;

  const selectedProduct = this.selectedProduct;

  this.quantity.set(safeQuantity);

  const productPrice = selectedProduct?.price;

  if (productPrice && this.price() === 0) {
    this.price.set(Number(productPrice));
  }

  this.totalPrice.set(
    this.price() * safeQuantity
  );
}
// ============================================
// ✅ Create Order
// ============================================
createOrder(customerId: number): void {
  const customer = this.selectedCustomer();
  const productId = this.productId();
  const selectedProduct = this.selectedProduct;

  if (!customer) {
  return;
}

  if (productId === null || !selectedProduct) {
    this.productError.set('Please select a product.');

    return;
  }

  this.calculateTotal();

  if (this.quantity() <= 0) {
    console.warn('Quantity must be greater than zero');
    return;
  }

  if (this.quantity() > selectedProduct.stock) {
    console.warn('Requested quantity exceeds available stock');
    return;
  }

  const order: CreateOrderPayload = {
    customerId : customer.id ,
    customerName: customer?.name || this.customerName(),
    phone: customer?.phone || this.phone(),
    address: customer?.address || this.address(),
    productId,
    price: this.price(),
    size: this.size(),
    quantity: this.quantity(),
  };

  this.localOrdersService.addOrder(order).subscribe({

    next: (response) => {

      console.log('Order saved', response);
       console.log(order);
      this.toastService.success('Order created successfully.');

      

      if (this.isWalkInCustomer()) {
        this.router.navigate(['/customer', customer.id]);
      }
      this.resetForm();
    },

    error: (error) => {

      console.error('Failed to save order', error);

      this.toastService.error('Failed to save order. Please check stock and try again.');

     
    },

  });
}




// ======================================================
// Order Actions
// ======================================================

/**
 * Validates the form and creates a new order.
 */
addOrder(): void {
  // Clear previous validation messages
  this.clearValidationErrors();
  const selectedCustomer = this.selectedCustomer();
  const selectedProduct = this.selectedProduct;

  const productId = this.productId();
  const size = this.size().trim();

  const customerName = this.customerName().trim();
  const phone = this.phone().trim();
  const address = this.address().trim();

  if (this.isWalkInCustomer()) {
    if (!this.selectedCustomer()) this.loadWalkInCustomer();
    if (!this.selectedCustomer()) return;
  }

  // ---------------- STEP 1: Customer ----------------
  if (!selectedCustomer) {
    this.checkCustomer();
    return;
  }

  // ============================================
// ✅ Validate Customer Name
// ============================================
if (!customerName) {

  this.customerNameError.set('Customer name is required.');

  return;

}

// ============================================
// ✅ Validate Phone Number
// ============================================
if (!phone) {

  this.phoneError.set('Phone number is required.');

  return;

}

  if (productId === null || !selectedProduct) {
   this.productError.set('Please select a product.');
    return;
  }

  this.calculateTotal();

  if (this.quantity() <= 0) {
    console.warn('Quantity must be greater than zero');
    return;
  }

  if (this.quantity() > selectedProduct.stock) {
    console.warn('Requested quantity exceeds available stock');
    return;
  }

  // ---------------- STEP 3: Payload ----------------
  this.addCurrentOrderToList();
}

private addCurrentOrderToList(): void {
  const customer = this.selectedCustomer();
  const selectedProduct = this.selectedProduct;
  const productId = this.productId();
  if (!customer || productId === null || !selectedProduct) return;

  this.calculateTotal();
  const quantity = Number(this.quantity());
  const alreadyQueued = this.pendingOrders()
    .filter((order) => order.productId === productId)
    .reduce((total, order) => total + Number(order.quantity), 0);

  if (quantity <= 0 || alreadyQueued + quantity > Number(selectedProduct.stock)) {
    this.productError.set('The total quantity for this product exceeds available stock.');
    return;
  }

  this.pendingOrders.update((orders) => [...orders, {
    customerId: customer.id,
    customerName: customer.name || this.customerName(),
    phone: customer.phone || this.phone(),
    address: customer.address || this.address(),
    productId,
    price: this.price(),
    size: this.size().trim(),
    quantity,
  }]);
  this.toastService.success('Order added to the list successfully.');
  this.resetOrderFields();
}

removePendingOrder(index: number): void {
  this.pendingOrders.update((orders) => orders.filter((_, i) => i !== index));
}

get pendingTotal(): number {
  return this.pendingOrders().reduce((total, order) => total + Number(order.price) * Number(order.quantity), 0);
}

sendAllOrders(): void {
  const orders = this.pendingOrders();
  if (!orders.length || this.isSubmitting()) return;
  this.isSubmitting.set(true);
  this.localOrdersService.addOrders(orders).subscribe({
   next: (response) => {
  const customerId = orders[0].customerId;
  this.toastService.success(`${orders.length} orders saved successfully!`);

  this.pendingOrders.set([]);
  this.isSubmitting.set(false);
  this.resetForm();

  this.router.navigate(['/customer', customerId]);

},
    error: (error) => {
      console.error('Failed to save orders', error);
      this.toastService.error('Some orders could not be saved. Please check stock and try again.');
      this.isSubmitting.set(false);
    },
  });
}

// ======================================================
// Form Helpers
// ======================================================

/**
 * Clears the order form.
 */
resetForm(): void {

  this.selectedCustomer.set(null);

  this.isWalkInCustomer.set(false);

this.customerName.set('');
this.phone.set('');
this.address.set('');

this.resetOrderFields();


}

private resetOrderFields(): void {
  this.productId.set(null);
  this.quantity.set(1);
  this.price.set(0);
  this.size.set('');
  this.totalPrice.set(0);
}
// ============================================
// ✅ Clear Validation Errors
// ============================================
clearValidationErrors(): void {

  this.customerNameError.set('');
  this.phoneError.set('');
  this.productError.set('');
}
}
