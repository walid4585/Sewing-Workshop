import { CommonModule   } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder,FormsModule, Validators } from '@angular/forms';
import { TransactionsService } from '../../../shared/transactions/transactions.service';
import { LocalOrdersService } from '../../../shared/local-orders/local-orders.service';
import { Transaction } from '../../../models/transaction.model';
import { CreateOrderPayload, Order } from '../../../models/order.model';
import { ModalComponent } from '../../../layout/modal/modal';
import { ToastService } from '../../../shared/toast/toast';
import { ProductRecord } from '../../../models/product.model';
import { LocalProductesService } from '../../../shared/local-product/local-productes.service';
import {LocalCustomersService} from '../../../shared/local-customers/local-customers.service';
import { RouterLink } from '@angular/router';
interface CustomerInfo {
  id: number;

  name: string;

  phone: string;

  address: string;

  hasOpenCycle: number | boolean;

}
interface PaymentRecord {
  id: number;

  amount: number;

  date: string;

  description: string;

}
@Component({
  selector: 'app-customer-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule ,FormsModule,RouterLink, ModalComponent],
  templateUrl: './customer-page.html',
  styleUrls: ['./customer-page.css'],
})
export class CustomerPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(LocalOrdersService);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private readonly transactionsService = inject(TransactionsService);
  private readonly toast = inject(ToastService);
  private readonly productsService = inject(LocalProductesService);
  private readonly localCustomersService = inject(LocalCustomersService);
  
get isActive(): boolean {
  return !!this.customer?.hasOpenCycle;
}

  customerId!: number;
  customer: CustomerInfo | null = null;
  orders: Order[] = [];
  payments: PaymentRecord[] = [];
  totalDue = 0;
  totalPaid = 0;
  debt = 0;
  productId = signal<number | null>(null);
size = signal('');
quantity = signal(1);
selectedProduct: ProductRecord | null = null;
//============================================
  //order model
  //============================================
  showOrderModal = signal(false);

price = signal(0);

  totalPrice = signal(0);

  showPaymentModal = false;
  paymentForm = this.fb.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().substring(0, 10), Validators.required],
    note: [''],
  });
  paymentSuccess = false;
// ============================================
// ✅ Products
// ============================================

readonly products = signal<ProductRecord[]>([]);

  
  // ============================================
  // ✅ Init
  // ============================================
  ngOnInit(): void {

  this.route.paramMap.subscribe(params => {

    this.customerId = Number(params.get('id'));

    

    if (this.customerId) {

      this.loadCustomerData();

     

    }

  });

  this.loadProducts();

}



 

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

selectOrderProduct(value: string): void {
  const productId = Number(value);
  const product = this.products().find(
    (item) => Number(item.id) === productId
  );

  if (!value || !Number.isFinite(productId) || !product) {
    this.productId.set(null);
    this.selectedProduct = null;
    this.price.set(0);
    this.totalPrice.set(0);
    return;
  }

  this.productId.set(productId);
  this.selectedProduct = product;
  this.price.set(product.price);
  this.calculateTotal();
}


// ============================================
// ✅ Load Products
// ============================================

private loadProducts(): void {

  this.productsService.getProducts().subscribe({

    next: (products) => {

      this.products.set(products);

    },

    error: console.error

  });

}
// ============================================
// ✅ Update Total
// ============================================

updateTotal(): void {

  const order = this.editingOrder();

  if (!order) {

    return;

  }

  const price = order.price ?? 0;

  const quantity = order.quantity ?? 0;

  order.totalPrice = price * quantity;

}

// ============================================
// ✅ Product Changed
// ============================================

onProductChanged(productId: string): void {

  const order = this.editingOrder();

  if (!order) {

    return;

  }

  const product = this.products().find(

    p => String(p.id) === productId

  );

  if (!product) {

    return;

  }

  order.product = product.title;

  order.price = product.price;

  order.totalPrice = order.price * order.quantity;

}

// ============================================
// ✅ Save Order Changes
// ============================================

saveOrderChanges(): void {
console.log('save order changes worker');
  const order = this.editingOrder();

  if (!order) {

    return;

  }

  this.ordersService.updateOrder(order).subscribe({

    next: () => {

      this.loadCustomerData();

      this.closeEditOrderModal();

    },

    error: (error) => {

      console.error(error);

    }

  });

}


/**
 * Converts any product id to a valid number.
 */
normalizeProductId(value: string | number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}



  // ============================================
  // ✅ Load Customer Data
  // ============================================
  loadCustomerData(): void {
    console.log('Customer Id:', this.customerId);
    this.localCustomersService.getCustomerAccount(this.customerId).subscribe({
     next: (response: any) => {

    this.customer = response.data.customer;

    this.orders = response.data.orders;

    this.payments = response.data.payments;

    this.totalDue = response.data.balance?.totalOrders ?? 0;

    this.totalPaid = response.data.balance?.totalPayments ?? 0;

    this.debt = response.data.balance?.remaining ?? 0;

    this.cdr.markForCheck();

},
      error: (err) => {
        console.error('Failed to load customer orders', err);
      },
    });
  }

  // ============================================
  // ✅ Load Payments
  // ============================================
  loadPayments(): void {
    this.transactionsService.getTransactions({
      entityType: 'customer',
      entityId: this.customer!.id
    }).subscribe({
      next: (transactions) => {
        this.payments = transactions.map(transaction => ({
          id: transaction.id!,
          amount: transaction.amount,
          date: transaction.transactionDate,
          description: transaction.note ?? ''
                            }));
        this.calculateSummary();
        this.cdr.markForCheck();
      }
    });
  }

  // ============================================
  // ✅ Calculate Summary
  // ============================================
  calculateSummary(): void {
    this.totalDue = this.orders.reduce(
      (sum, order) => sum + Number(order.totalPrice || 0),
      0
    );

    this.totalPaid = this.payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    this.debt = this.totalDue - this.totalPaid;
  }

  // ============================================
  // ✅ Computed Properties
  // ============================================
  get totalOrders(): number {
    return this.orders.length;
  }

  // ============================================
  // ✅ Format Currency
  // ============================================
  formatCurrency(amount: number): string {
    return amount.toLocaleString() + ' DA';
  }

  // ============================================
  // ✅ Helper: Get Initials
  // ============================================
  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ============================================
  // ✅ Helper: Get Avatar Color
  // ============================================
  getAvatarColor(name: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#FF8A5C', '#A29BFE',
      '#FD79A8', '#00CEC9', '#FDCB6E', '#6C5CE7',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#01a3a4',
      '#FF6B81', '#2ED573', '#1E90FF', '#F9CA24'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

// ============================================
// ✅ Go Back
// ============================================
  goBack(): void {
    window.history.back();
  }

  // ============================================
  // ✅ Add Payment
  // ============================================
  addPayment(): void {
    this.showPaymentModal = true;
  }

  // ============================================
  // ✅ Close Payment Modal
  // ============================================
  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.paymentSuccess = false;
    this.paymentForm.reset({
      amount: 0,
      date: new Date().toISOString().substring(0, 10),
      note: ''
    });
  }

  // ============================================
  // ✅ Save Payment
  // ============================================
  savePayment(): void {
    this.isEditingPayment.set(false);

    console.log(this.paymentForm.value);
    const form = this.paymentForm.value;
    const transaction: Transaction = {
      type: 'customer_payment',
      direction: 'IN',
      amount: form.amount!,
      entityType: 'customer',
      entityId: this.customer!.id,
      orderId: null,
      note: form.note ?? '',
      transactionDate: form.date!,
      status: 'completed'
    };
   console.log('transaction', transaction);
    this.transactionsService.createTransaction(transaction).subscribe({
      next: (response) => {
        // ثانياً: أظهر شاشة النجاح
        this.paymentSuccess = true;
        this.cdr.markForCheck();

        // ثالثاً: انتظر قليلاً
        setTimeout(() => {
          // أغلق المودال أولاً
          this.showPaymentModal = false;
          // ثم أعد الحالة للوضع الطبيعي
          this.paymentSuccess = false;
          // صفّر النموذج
          this.paymentForm.reset({
            amount: 0,
            date: new Date().toISOString().substring(0, 10),
            note: ''
          });
          // حدّث البيانات
          this.loadCustomerData();
        }, 1500);
      },
      error: (error) => {

  console.error(error);

  this.toast.error(

    error.error?.message ||

    'Failed to save payment.'

  );

}
    });
  }
  // ============================================
// ✅ Delete Payment
// ============================================

readonly selectedPayment = signal<PaymentRecord | null>(null);

readonly showDeletePaymentModal = signal(false);

// ============================================
// ✅ Open Delete Payment Modal
// ============================================

deletePayment(payment: PaymentRecord): void {
  

  this.selectedPayment.set(payment);

  this.showDeletePaymentModal.set(true);
}
// ============================================
// ✅ Close Delete Payment Modal
// ============================================

closeDeletePaymentModal(): void {

  this.showDeletePaymentModal.set(false);

  this.selectedPayment.set(null);

}
// ============================================
// ✅ Confirm Delete Payment
// ============================================

confirmDeletePayment(): void {

  const payment = this.selectedPayment();

  if (!payment) {

    return;

  }

  this.transactionsService
    .deleteTransaction(payment.id)
    .subscribe({

      next: () => {

        this.toast.success('Payment deleted successfully.');

        this.closeDeletePaymentModal();

        this.loadPayments();

      },

      error: (error) => {

        console.error(error);

        this.toast.error('Failed to delete payment.');

      }

    });

}

// ============================================
// ✅ Edit Payment
// ============================================

readonly showEditPaymentModal = signal(false);

readonly editingPayment = signal<PaymentRecord | null>(null);

readonly isEditingPayment = signal(false);
// ============================================
// ✅ Open Edit Payment Modal
// ============================================

editPayment(payment: PaymentRecord): void {

  this.isEditingPayment.set(true);

  this.selectedPayment.set(payment);

  this.paymentForm.patchValue({

    amount: payment.amount,

    date: payment.date,

    note: payment.description

  });

  this.showPaymentModal = true;

}
// ============================================
// ✅ Update Payment
// ============================================

updatePayment(): void {
  console.log('updatePayment button work');
   const form = this.paymentForm.value;
  const payment = this.selectedPayment();
  if (!payment) {

  return;

}
   const transaction: Transaction = {

    id: payment.id,

    type: 'customer_payment',

    direction: 'IN',

    amount: form.amount!,

    entityType: 'customer',

    entityId: Number(this.customerId),

    orderId: null,

    note: form.note ?? '',

    transactionDate: form.date!,

    status: 'completed'

  };

 

this.transactionsService.updateTransaction(

  payment.id,

  transaction

).subscribe({

  next: () => {
     this.paymentSuccess = true;
        this.cdr.markForCheck();
        // ثالثاً: انتظر قليلاً
        setTimeout(() => {
          // أغلق المودال أولاً
          this.showPaymentModal = false;
          // ثم أعد الحالة للوضع الطبيعي
          this.paymentSuccess = false;
          // صفّر النموذج
          this.paymentForm.reset({
            amount: 0,
            date: new Date().toISOString().substring(0, 10),
            note: ''
          });
          // حدّث البيانات
          this.loadCustomerData();
        }, 1500);
    
  },

 error: (error) => {

  console.error(error);

  this.toast.error(

    error.error?.message ||

    'Failed to edit payment.'

  );

}

});

}
// ============================================
// ✅ Close Edit Payment Modal
// ============================================

closeEditPaymentModal(): void {

  this.showEditPaymentModal.set(false);

  this.editingPayment.set(null);

}
// ============================================
// ✅ Save Payment Changes
// ============================================

savePaymentChanges(): void {

  console.log(this.editingPayment());

}

showOrderform(): void{
  console.log('order form work')
this.showOrderModal.set(true);


}
 
closeOrderform():void{
  this.showOrderModal.set(false);
}


newOrder(): void {

  // ============================================
  // STEP 1: Customer
  // ============================================

  if (!this.customer) {
    this.toast.error('Customer data is not loaded.');
    return;
  }

  // ============================================
  // STEP 2: Product
  // ============================================

  const productId = this.productId();
  const size = this.size().trim();
  const quantity = this.quantity();

  const selectedProduct = this.products().find(
    product => Number(product.id) === productId
  );

  if (productId === null || !selectedProduct) {
    this.toast.error('Please select a product.');
    return;
  }

 

  // ============================================
  // STEP 4: Quantity
  // ============================================

  if (quantity <= 0) {
    this.toast.error('Quantity must be greater than zero.');
    return;
  }

  if (quantity > selectedProduct.stock) {
    this.toast.error('Requested quantity exceeds available stock.');
    return;
  }

  // ============================================
  // STEP 5: Create Order
  // ============================================

  const order: CreateOrderPayload = {
   

    customerId: this.customer.id,
    customerName: this.customer.name,
    phone: this.customer.phone,
    address: this.customer.address,

  
    productId: Number(selectedProduct.id),

    size,
    price: selectedProduct.price,
    quantity,

  };

  console.log('New customer order:', order);

  // هنا نستعمل نفس طريقة الإضافة الموجودة
  // في LocalOrdersService / NewOrdersComponent
  this.ordersService.addOrder(order).subscribe({
    next: () => {
      this.toast.success('Order created successfully.');
      this.closeOrderform();
      this.loadCustomerData();
    },
    error: (error) => {
      console.error('Failed to create order', error);
      this.toast.error(
        error.error?.message ||
        'Failed to create order.'
      );
    }
  });
}



  // ============================================
// ✅ Delete Order
// ============================================

selectedOrder = signal<Order | null>(null);

showDeleteOrderModal = signal(false);
// ============================================
// ✅ Delete Order
// ============================================

deleteOrder(order: Order): void {

  this.selectedOrder.set(order);

  this.showDeleteOrderModal.set(true);

}
// ============================================
// ✅ Close Delete Order Modal
// ============================================

closeDeleteOrderModal(): void {

  this.showDeleteOrderModal.set(false);

  this.selectedOrder.set(null);

}
// ============================================
// ✅ Confirm Delete Order
// ============================================

confirmDeleteOrder(): void {

  const order = this.selectedOrder();

  if (!order) {

    return;

  }

  this.ordersService.deleteOrder(order.id).subscribe({

    next: () => {

      this.closeDeleteOrderModal();

      this.loadCustomerData();

    },

    error: (error) => {

      console.error('Failed to delete order', error);

    }

  });

}
// ============================================
// ✅ Edit Order
// ============================================

editingOrder = signal<Order | null>(null);

showEditOrderModal = signal(false);
// ============================================
// ✅ Edit Order
// ============================================

editOrder(order: Order): void {

  this.editingOrder.set({ ...order });

  this.showEditOrderModal.set(true);

}
// ============================================
// ✅ Close Edit Order Modal
// ============================================

closeEditOrderModal(): void {

  this.showEditOrderModal.set(false);

  this.editingOrder.set(null);

}
  // ============================================
  // ✅ Print Page
  // ============================================
  // ============================================
// ✅ Print Page - Customer Statement
// ============================================
printPage(): void {
  // ============================================
  // 1. Get current data
  // ============================================
  const customer = this.customer;
  const orders = this.orders;
  const payments = this.payments;

  // ============================================
  // 2. Validate data
  // ============================================
  if (!customer) {
    console.error('No customer data available');
    return;
  }

  // ============================================
  // 3. Calculate totals
  // ============================================
  const totalOrders = orders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balance = totalOrders - totalPaid;

  const orderCount = orders.length;
  const paymentCount = payments.length;

  // ============================================
  // 4. Build statement HTML
  // ============================================
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Customer Statement - ${customer.name}</title>
      <style>
        /* ============================================
           Reset & Base Styles
           ============================================ */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 24px;
          background: #ffffff;
          color: #1a1a2e;
          line-height: 1.6;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ============================================
           Print Styles
           ============================================ */
        @media print {
          body {
            padding: 16px;
            font-size: 11px;
          }
          
          .no-print {
            display: none !important;
          }
          
          table {
            font-size: 11px;
          }
          
          .header {
            border-bottom-width: 2px;
            margin-bottom: 16px;
          }
          
          .info-section {
            padding: 10px;
            margin-bottom: 16px;
          }
          
          .summary-section {
            padding: 10px;
          }
          
          .footer {
            margin-top: 24px;
            padding-top: 12px;
          }
        }

        /* ============================================
           Header
           ============================================ */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 4px solid #2563eb;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }

        .logo {
          flex-shrink: 0;
        }

        .logo img {
          height: 60px;
          width: auto;
        }

        .title {
          text-align: center;
          flex: 1;
        }

        .title h1 {
          font-size: 26px;
          color: #0f172a;
          margin-bottom: 4px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .title h2 {
          font-size: 20px;
          color: #334155;
          font-weight: 500;
        }

        .title .subtitle {
          font-size: 14px;
          color: #64748b;
          font-weight: 400;
          margin-top: 2px;
        }

        /* ============================================
           Info Section
           ============================================ */
        .info-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px 24px;
        }

        .info-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
        }

        .info-item .label {
          font-weight: 600;
          color: #475569;
          margin-right: 8px;
          font-size: 13px;
          min-width: 80px;
        }

        .info-item .value {
          color: #0f172a;
          font-weight: 500;
          font-size: 13px;
        }

        .info-item .badge {
          display: inline-block;
          padding: 2px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-active {
          background: #dcfce7;
          color: #16a34a;
        }

        .badge-inactive {
          background: #fee2e2;
          color: #dc2626;
        }

        /* ============================================
           Table Section
           ============================================ */
        .table-section {
          margin-bottom: 24px;
        }

        .table-section .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #e2e8f0;
        }

        .table-section h3 {
          font-size: 17px;
          color: #0f172a;
          font-weight: 600;
        }

        .table-section .count-badge {
          background: #e2e8f0;
          padding: 2px 12px;
          border-radius: 20px;
          font-size: 13px;
          color: #475569;
          font-weight: 500;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        table thead th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 600;
          padding: 10px 14px;
          text-align: left;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        table tbody td {
          padding: 9px 14px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }

        table tbody tr:nth-child(even) {
          background: #fafbfc;
        }

        table tbody tr:hover {
          background: #f1f5f9;
        }

        .total-row td {
          background: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
          border-top: 2px solid #94a3b8;
        }

        .text-center {
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          padding: 20px !important;
        }

        .text-right {
          text-align: right;
        }

        .text-muted {
          color: #94a3b8;
          font-size: 12px;
        }

        /* ============================================
           Summary Section
           ============================================ */
        .summary-section {
          background: #f1f5f9;
          border-radius: 10px;
          padding: 18px 20px;
          margin-top: 8px;
          border: 1px solid #e2e8f0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .summary-item .label {
          font-weight: 500;
          color: #475569;
          font-size: 14px;
        }

        .summary-item .value {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
        }

        .summary-item.positive .value {
          color: #16a34a;
        }

        .summary-item.negative .value {
          color: #dc2626;
        }

        .summary-item.neutral .value {
          color: #2563eb;
        }

        .summary-item .status-icon {
          font-size: 18px;
          margin-right: 6px;
        }

        /* ============================================
           Footer
           ============================================ */
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer .print-time {
          color: #94a3b8;
        }

        .footer .page-info {
          color: #94a3b8;
        }

        /* ============================================
           Utility Classes
           ============================================ */
        .mt-1 { margin-top: 8px; }
        .mb-1 { margin-bottom: 8px; }
        .fw-600 { font-weight: 600; }
        .fs-12 { font-size: 12px; }
        .color-slate { color: #64748b; }
      </style>
    </head>
    <body>
      <!-- ==========================================
           HEADER
           ========================================== -->
      <div class="header">
        <div class="logo">
          <img src="assets/logo.png" alt="Workshop Logo" height="60">
        </div>
        <div class="title">
          <h1>Customer Statement</h1>
          <h2>${customer.name}</h2>
          <div class="subtitle">Account Statement &amp; Balance Summary</div>
        </div>
      </div>

      <!-- ==========================================
           CUSTOMER INFORMATION
           ========================================== -->
      <div class="info-section">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Customer:</span>
            <span class="value">${customer.name}</span>
          </div>
          <div class="info-item">
            <span class="label">Phone:</span>
            <span class="value">${customer.phone || 'Not registered'}</span>
          </div>
          ${customer.address ? `
          <div class="info-item">
            <span class="label">Address:</span>
            <span class="value">${customer.address}</span>
          </div>
          ` : ''}
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value">
              <span class="badge ${customer.hasOpenCycle ? 'badge-active' : 'badge-inactive'}">
                ${customer.hasOpenCycle ? '● Active' : '● Inactive'}
              </span>
            </span>
          </div>
          <div class="info-item">
            <span class="label">Customer ID:</span>
            <span class="value">#${customer.id}</span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           ORDERS TABLE
           ========================================== -->
      <div class="table-section">
        <div class="section-header">
          <h3>Orders</h3>
          <span class="count-badge">${orderCount} orders</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${orders.length > 0 ? orders.map((order, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${order.product || 'Not specified'}</td>
                <td class="text-right">${order.quantity || 0}</td>
                <td class="text-right">${order.price || 0} USD</td>
                <td class="text-right">${order.totalPrice || 0} USD</td>
                <td>${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                <td>${order.status || 'Pending'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" class="text-center">No orders found</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="4"><strong>Total Orders</strong></td>
              <td class="text-right"><strong>${totalOrders} USD</strong></td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ==========================================
           PAYMENTS TABLE
           ========================================== -->
      <div class="table-section">
        <div class="section-header">
          <h3>Payments</h3>
          <span class="count-badge">${paymentCount} payments</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th class="text-right">Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length > 0 ? payments.map((payment, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${payment.date ? new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified'}</td>
                <td class="text-right">${payment.amount} USD</td>
                <td>${payment.description || '-'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="4" class="text-center">No payments found</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="2"><strong>Total Payments</strong></td>
              <td class="text-right"><strong>${totalPaid} USD</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ==========================================
           SUMMARY
           ========================================== -->
      <div class="summary-section">
        <div class="summary-grid">
          <div class="summary-item neutral">
            <span class="label">Total Orders</span>
            <span class="value">${totalOrders} USD</span>
          </div>
          <div class="summary-item neutral">
            <span class="label">Total Payments</span>
            <span class="value">${totalPaid} USD</span>
          </div>
          <div class="summary-item ${balance > 0 ? 'negative' : balance < 0 ? 'positive' : 'neutral'}">
            <span class="label">Balance</span>
            <span class="value">${balance} USD</span>
          </div>
          <div class="summary-item ${balance === 0 ? 'positive' : balance > 0 ? 'negative' : 'neutral'}">
            <span class="label">Account Status</span>
            <span class="value">
              ${balance === 0 ? '✅ Settled' : balance > 0 ? '⚠️ Outstanding' : '🔴 Credit'}
            </span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           FOOTER
           ========================================== -->
      <div class="footer">
        <span class="print-time">Printed: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
        <span class="page-info">Customer Statement &bull; ${customer.name}</span>
      </div>
    </body>
    </html>
  `;

  // ============================================
  // 5. Open print window
  // ============================================
  const printWindow = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');

  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = function() {
    printWindow.focus();
    
    // Small delay to ensure styles are applied
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}
}
