// customer-history-page.ts
import { Component, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalCustomersService } from '../../../shared/local-customers/local-customers.service';
import { FormsModule } from '@angular/forms';

// ============================================
// ✅ Interfaces
// ============================================

export interface Order {
  name?: string;
  product?: string;
  quantity: number;
  price: number;
}

export interface Payment {
  amount: number;
  date?: string;
  method?: string;
}

export interface Balance {
  totalOrders: number;
  totalPayments: number;
  remaining: number;
}

export interface CustomerCycle {
  id: number;
  status: 'open' | 'closed' | 'pending';
  openedAt: string;
  closedAt: string;
  orders: Order[];
  payments: Payment[];
  balance: Balance;
}

export interface Customer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  since?: string;
}

// ============================================
// ✅ الـ Component
// ============================================

@Component({
  selector: 'app-customer-history-page',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './customer-history-page.html',
  styleUrl: './customer-history-page.css',
})
export class CustomerHistoryPage implements OnInit {
  
  // ============================================
  // 📦 Properties
  // ============================================
   filteredCycles: CustomerCycle[] = [];
  customerCycles: CustomerCycle[] = [];
  expandedCycle: number | null = null;
  customerId!: number;
  
  customer: Customer = {
    name: '',
    phone: '',
    email: '',
    address: '',
    since: ''
  };

 // ============================================
  // 🔍 Filter Properties
  // ============================================
  
  showFilter: boolean = false;
  
  filterOptions = {
    status: 'all' as 'all' | 'open' | 'closed' | 'pending',
    dateRange: 'all' as 'all' | '7days' | '30days' | '90days',
    searchTerm: '',
    minAmount: null as number | null,
    maxAmount: null as number | null
  };

  // ============================================
  // 🔧 Injections
  // ============================================
  
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly localCustomersService = inject(LocalCustomersService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ============================================
  // 🚀 Lifecycle Hooks
  // ============================================

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.customerId = Number(params.get('id'));
      if (this.customerId) {
        this.loadCustomerHistory();
        this.loadCustomerInfo();
      }
    });
  }

  // ============================================
  // 📥 Data Loading
  // ============================================

  loadCustomerHistory(): void {
    this.localCustomersService
      .getCustomerCyclesHistory(this.customerId)
      .subscribe({
        next: (response: any) => {
          this.customerCycles = response.data || [];
           this.filteredCycles = [...this.customerCycles]; 
          
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('❌ Error loading cycles:', err);
        }
      });
  }

  loadCustomerInfo(): void {
 
    this.localCustomersService.getCustomerAccount(this.customerId).subscribe({
     next: (response: any) => {

    this.customer = response.data.customer;

   
    this.cdr.markForCheck();

},
      error: (err) => {
        console.error('Failed to load customer orders', err);
      },
    });
  }

  // ============================================
  // 🎯 UI Actions
  // ============================================

toggleCycle(cycleId: number): void {
  this.expandedCycle =
    this.expandedCycle === cycleId ? null : cycleId;
}
toggleFilter(): void {
    this.showFilter = !this.showFilter;
    if (!this.showFilter) {
      // إذا أغلقنا الفلتر، نعيد تعيين الخيارات
      this.resetFilters();
    }
  }

// ============================================
  // 🔍 Filter Logic
  // ============================================

  applyFilters(): void {
    this.filteredCycles = this.customerCycles.filter(cycle => {
      let matches = true;

      // 1️⃣ فلتر حسب الحالة
      if (this.filterOptions.status !== 'all') {
        matches = matches && cycle.status === this.filterOptions.status;
      }

      // 2️⃣ فلتر حسب التاريخ
      if (this.filterOptions.dateRange !== 'all') {
        const cycleDate = new Date(cycle.openedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - cycleDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        switch (this.filterOptions.dateRange) {
          case '7days':
            matches = matches && diffDays <= 7;
            break;
          case '30days':
            matches = matches && diffDays <= 30;
            break;
          case '90days':
            matches = matches && diffDays <= 90;
            break;
        }
      }

      // 3️⃣ فلتر بالبحث (رقم الدورة أو أي حقل آخر)
      if (this.filterOptions.searchTerm.trim()) {
        const search = this.filterOptions.searchTerm.toLowerCase().trim();
        matches = matches && (
          cycle.id.toString().includes(search) ||
          cycle.status.toLowerCase().includes(search) ||
          cycle.openedAt.includes(search) ||
          cycle.closedAt.includes(search)
        );
      }

      // 4️⃣ فلتر حسب الحد الأدنى للمبلغ
      if (this.filterOptions.minAmount !== null) {
        matches = matches && cycle.balance.totalOrders >= this.filterOptions.minAmount;
      }

      // 5️⃣ فلتر حسب الحد الأقصى للمبلغ
      if (this.filterOptions.maxAmount !== null) {
        matches = matches && cycle.balance.totalOrders <= this.filterOptions.maxAmount;
      }

      return matches;
    });

    // إعادة تعيين التوسيع بعد التصفية
    this.expandedCycle = null;
    this.cdr.markForCheck();
    
    console.log(`✅ Filter applied: ${this.filteredCycles.length} cycles found`);
  }

  resetFilters(): void {
    this.filterOptions = {
      status: 'all',
      dateRange: 'all',
      searchTerm: '',
      minAmount: null,
      maxAmount: null
    };
    this.filteredCycles = [...this.customerCycles];
    this.cdr.markForCheck();
  }

  // ============================================
  // 📊 Statistics with Filters
  // ============================================

  getFilteredTotalOrders(): number {
    return this.filteredCycles.reduce((total, cycle) => {
      return total + (cycle.balance?.totalOrders || 0);
    }, 0);
  }

  getFilteredTotalSpent(): number {
    return this.filteredCycles.reduce((total, cycle) => {
      return total + (cycle.balance?.totalPayments || 0);
    }, 0);
  }

  getFilteredCount(): number {
    return this.filteredCycles.length;
  }


  goBack(): void {
    window.history.back();
  }

  // ============================================
  // 🖨️ Print & Share
  // ============================================

  printInvoice(cycle: CustomerCycle): void {
     // ============================================
  // 1. Get current data
  // ============================================
  const customer = this.customer;
  const cycles = this.filteredCycles.length > 0 ? this.filteredCycles : this.customerCycles;

  // ============================================
  // 2. Validate data
  // ============================================
  if (!customer || !customer.name) {
    console.error('No customer data available');
    return;
  }

  if (!cycles || cycles.length === 0) {
    console.error('No cycles available to print');
    return;
  }

  // ============================================
  // 3. Calculate totals
  // ============================================
  const totalOrders = cycles.reduce((sum, cycle) => sum + (cycle.balance?.totalOrders || 0), 0);
  const totalPayments = cycles.reduce((sum, cycle) => sum + (cycle.balance?.totalPayments || 0), 0);
  const totalRemaining = cycles.reduce((sum, cycle) => sum + (cycle.balance?.remaining || 0), 0);

  const cycleCount = cycles.length;
  const activeCycles = cycles.filter(c => c.status === 'open').length;
  const closedCycles = cycles.filter(c => c.status === 'closed').length;
  const pendingCycles = cycles.filter(c => c.status === 'pending').length;

  // ============================================
  // 4. Build statement HTML - Each cycle on separate page
  // ============================================
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Customer History - ${customer.name}</title>
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
           Print Styles - Each cycle on new page
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
          
          .stats-section {
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
          
          /* Each cycle on its own page */
          .cycle-page {
            page-break-after: always;
            page-break-inside: avoid;
            margin-bottom: 0;
            padding-bottom: 20px;
          }
          
          .cycle-page:last-child {
            page-break-after: auto;
          }
          
          .cycle-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        /* ============================================
           Page Break for Screen View
           ============================================ */
        .cycle-page {
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 2px dashed #e2e8f0;
        }
        
        .cycle-page:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
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

        .title .cycle-counter {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 400;
          margin-top: 4px;
        }

        /* ============================================
           Info Section
           ============================================ */
        .info-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 20px;
          border: 1px solid #e2e8f0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 6px 20px;
        }

        .info-item {
          display: flex;
          align-items: center;
          padding: 3px 0;
        }

        .info-item .label {
          font-weight: 600;
          color: #475569;
          margin-right: 8px;
          font-size: 13px;
          min-width: 70px;
        }

        .info-item .value {
          color: #0f172a;
          font-weight: 500;
          font-size: 13px;
        }

        /* ============================================
           Cycle Card
           ============================================ */
        .cycle-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .cycle-card .cycle-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .cycle-card .cycle-header .cycle-id {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
        }

        .cycle-card .cycle-header .cycle-status {
          display: inline-block;
          padding: 3px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .cycle-status.open {
          background: #dbeafe;
          color: #2563eb;
        }

        .cycle-status.closed {
          background: #dcfce7;
          color: #16a34a;
        }

        .cycle-status.pending {
          background: #fef3c7;
          color: #d97706;
        }

        .cycle-card .cycle-header .cycle-date {
          font-size: 13px;
          color: #64748b;
        }

        .cycle-card .cycle-header .cycle-amount {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
        }

        .cycle-card .cycle-body {
          padding: 16px 18px;
        }

        .cycle-card .cycle-body .section-label {
          font-weight: 600;
          color: #475569;
          font-size: 13px;
          margin-bottom: 8px;
          display: block;
        }

        /* ============================================
           Tables
           ============================================ */
        .sub-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .sub-table thead th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 600;
          padding: 6px 12px;
          text-align: left;
          border: 1px solid #e2e8f0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }

        .sub-table tbody td {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
          font-size: 12px;
        }

        .sub-table tbody tr:nth-child(even) {
          background: #fafbfc;
        }

        .sub-table .total-row td {
          background: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
          border-top: 2px solid #94a3b8;
        }

        .sub-table .text-center {
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          padding: 12px !important;
        }

        .sub-table .text-right {
          text-align: right;
        }

        /* ============================================
           Balance Summary inside cycle
           ============================================ */
        .balance-summary {
          display: flex;
          gap: 16px;
          margin-top: 12px;
          padding: 10px 14px;
          background: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .balance-summary .balance-item {
          flex: 1;
        }

        .balance-summary .balance-item .b-label {
          font-size: 12px;
          color: #64748b;
        }

        .balance-summary .balance-item .b-value {
          font-weight: 700;
          font-size: 15px;
          color: #0f172a;
        }

        .balance-summary .balance-item .b-value.positive {
          color: #16a34a;
        }

        .balance-summary .balance-item .b-value.negative {
          color: #dc2626;
        }

        /* ============================================
           Footer
           ============================================ */
        .footer {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* ============================================
           Grand Summary (appears once at the end)
           ============================================ */
        .grand-summary-section {
          background: #f1f5f9;
          border-radius: 10px;
          padding: 18px 20px;
          margin-top: 20px;
          border: 1px solid #e2e8f0;
          page-break-after: avoid;
        }

        .grand-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .grand-summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .grand-summary-item .label {
          font-weight: 500;
          color: #475569;
          font-size: 14px;
        }

        .grand-summary-item .value {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
        }

        .grand-summary-item.positive .value {
          color: #16a34a;
        }

        .grand-summary-item.negative .value {
          color: #dc2626;
        }

        .grand-summary-item.neutral .value {
          color: #2563eb;
        }

        /* ============================================
           Utility
           ============================================ */
        .mt-2 { margin-top: 16px; }
        .mb-2 { margin-bottom: 16px; }
        .text-muted { color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>

      <!-- ==========================================
           MAIN HEADER (appears once)
           ========================================== -->
      <div class="header">
        <div class="logo">
          <img src="assets/logo.png" alt="Workshop Logo" height="60">
        </div>
        <div class="title">
          <h1>Customer History</h1>
          <h2>${customer.name}</h2>
          <div class="subtitle">Complete Transaction History</div>
        </div>
      </div>

      <!-- ==========================================
           CUSTOMER INFORMATION (appears once)
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
          ${customer.email ? `
          <div class="info-item">
            <span class="label">Email:</span>
            <span class="value">${customer.email}</span>
          </div>
          ` : ''}
          ${customer.address ? `
          <div class="info-item">
            <span class="label">Address:</span>
            <span class="value">${customer.address}</span>
          </div>
          ` : ''}
          <div class="info-item">
            <span class="label">Total Cycles:</span>
            <span class="value">${cycleCount}</span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           EACH CYCLE ON ITS OWN PAGE
           ========================================== -->
      ${cycles.map((cycle, cycleIndex) => `
        <div class="cycle-page">
          <div class="cycle-card">
            <!-- Cycle Header -->
            <div class="cycle-header">
              <div>
                <span class="cycle-id">Cycle #${cycle.id}</span>
                <span class="cycle-status ${cycle.status}">${cycle.status.toUpperCase()}</span>
                <span class="text-muted" style="margin-left: 12px;">Page ${cycleIndex + 1} of ${cycleCount}</span>
              </div>
              <div>
                <span class="cycle-date">
                  ${cycle.openedAt ? new Date(cycle.openedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                  ${cycle.closedAt ? ` → ${new Date(cycle.closedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : ' (Open)'}
                </span>
              </div>
              <div class="cycle-amount">${cycle.balance?.totalOrders || 0} USD</div>
            </div>

            <!-- Cycle Body -->
            <div class="cycle-body">
              <!-- Orders -->
              <span class="section-label">📦 Orders (${cycle.orders?.length || 0})</span>
              <table class="sub-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">#</th>
                    <th>Product</th>
                    <th class="text-right" style="width: 70px;">Qty</th>
                    <th class="text-right" style="width: 90px;">Price</th>
                    <th class="text-right" style="width: 100px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${cycle.orders && cycle.orders.length > 0 ? cycle.orders.map((order, orderIndex) => `
                    <tr>
                      <td>${orderIndex + 1}</td>
                      <td>${order.product || order.name || 'N/A'}</td>
                      <td class="text-right">${order.quantity || 0}</td>
                      <td class="text-right">${order.price || 0} USD</td>
                      <td class="text-right">${((order.quantity || 0) * (order.price || 0)).toFixed(2)} USD</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="5" class="text-center">No orders in this cycle</td>
                    </tr>
                  `}
                  <tr class="total-row">
                    <td colspan="4"><strong>Cycle Total</strong></td>
                    <td class="text-right"><strong>${cycle.balance?.totalOrders || 0} USD</strong></td>
                  </tr>
                </tbody>
              </table>

              <!-- Payments -->
              <span class="section-label" style="margin-top: 14px;">💳 Payments (${cycle.payments?.length || 0})</span>
              <table class="sub-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">#</th>
                    <th>Date</th>
                    <th class="text-right" style="width: 100px;">Amount</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  ${cycle.payments && cycle.payments.length > 0 ? cycle.payments.map((payment, paymentIndex) => `
                    <tr>
                      <td>${paymentIndex + 1}</td>
                      <td>${payment.date ? new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</td>
                      <td class="text-right">${payment.amount || 0} USD</td>
                      <td>${payment.method || 'Cash'}</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="4" class="text-center">No payments in this cycle</td>
                    </tr>
                  `}
                  <tr class="total-row">
                    <td colspan="2"><strong>Total Payments</strong></td>
                    <td class="text-right"><strong>${cycle.balance?.totalPayments || 0} USD</strong></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <!-- Balance Summary -->
              <div class="balance-summary">
                <div class="balance-item">
                  <div class="b-label">Total Orders</div>
                  <div class="b-value">${cycle.balance?.totalOrders || 0} USD</div>
                </div>
                <div class="balance-item">
                  <div class="b-label">Total Payments</div>
                  <div class="b-value">${cycle.balance?.totalPayments || 0} USD</div>
                </div>
                <div class="balance-item">
                  <div class="b-label">Remaining</div>
                  <div class="b-value ${(cycle.balance?.remaining || 0) > 0 ? 'negative' : 'positive'}">
                    ${cycle.balance?.remaining || 0} USD
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer for this cycle page -->
          <div class="footer">
            <span>Cycle #${cycle.id} &bull; ${cycle.status.toUpperCase()}</span>
            <span>Page ${cycleIndex + 1} of ${cycleCount}</span>
          </div>
        </div>
      `).join('')}

      <!-- ==========================================
           GRAND SUMMARY (appears once at the end)
           ========================================== -->
      <div class="grand-summary-section">
        <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 12px;">📊 Grand Summary</h3>
        <div class="grand-summary-grid">
          <div class="grand-summary-item neutral">
            <span class="label">Total Cycles</span>
            <span class="value">${cycleCount}</span>
          </div>
          <div class="grand-summary-item neutral">
            <span class="label">Active / Closed</span>
            <span class="value">${activeCycles} / ${closedCycles}</span>
          </div>
          <div class="grand-summary-item neutral">
            <span class="label">Total Orders (All Cycles)</span>
            <span class="value">${totalOrders} USD</span>
          </div>
          <div class="grand-summary-item neutral">
            <span class="label">Total Payments (All Cycles)</span>
            <span class="value">${totalPayments} USD</span>
          </div>
          <div class="grand-summary-item ${totalRemaining > 0 ? 'negative' : 'positive'}">
            <span class="label">Total Remaining Balance</span>
            <span class="value">${totalRemaining} USD</span>
          </div>
          <div class="grand-summary-item ${totalRemaining === 0 ? 'positive' : 'negative'}">
            <span class="label">Overall Status</span>
            <span class="value">${totalRemaining === 0 ? '✅ Settled' : totalRemaining > 0 ? '⚠️ Outstanding' : '🔴 Credit'}</span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           FINAL FOOTER
           ========================================== -->
      <div class="footer" style="margin-top: 16px;">
        <span class="print-time">Printed: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
        <span class="page-info">Customer History &bull; ${customer.name} &bull; ${cycleCount} cycles</span>
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

  shareCycle(cycle: CustomerCycle): void {
    console.log('📤 Sharing cycle:', cycle);
    // TODO: Implement share logic
    // يمكنك استخدام Web Share API
    if (navigator.share) {
      navigator.share({
        title: `Cycle #${cycle.id}`,
        text: `Cycle #${cycle.id} - Total: ${cycle.balance.totalOrders} DA`,
        url: window.location.href,
      }).catch(err => {
         console.log('Share cancelled:', err);
         navigator.clipboard.writeText(`Cycle #${cycle.id} - Total: ${cycle.balance.totalOrders} DA`).then(() => {
        alert('Cycle details copied to clipboard! ');
      });
    });
    } else {
      // Fallback: copy to clipboard
      const text = `Cycle #${cycle.id}\nTotal: ${cycle.balance.totalOrders} DA\nPaid: ${cycle.balance.totalPayments} DA\nRemaining: ${cycle.balance.remaining || 0} DA`;
      navigator.clipboard.writeText(text).then(() => {
        alert('Cycle details copied to clipboard!');
      });
    }
  }

  // ============================================
  // 📊 Calculations
  // ============================================

  getTotalOrders(): number {
    return this.customerCycles.reduce((total, cycle) => {
      return total + (cycle.balance?.totalOrders || 0);
    }, 0);
  }

  getTotalSpent(): number {
    return this.customerCycles.reduce((total, cycle) => {
      return total + (cycle.balance?.totalPayments || 0);
    }, 0);
  }

  getAverageOrder(): number {
    const total = this.getTotalOrders();
    const count = this.customerCycles.length;
    if (count === 0) return 0;
    return Math.round(total / count);
  }

  getTotalQuantity(orders: Order[]): number {
    return orders.reduce((sum, order) => sum + (order.quantity || 0), 0);
  }

  getDuration(cycle: CustomerCycle): string {
    if (!cycle.openedAt || !cycle.closedAt) return '';
    const start = new Date(cycle.openedAt);
    const end = new Date(cycle.closedAt);
    const diff = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days === 1 ? '1 day' : `${days} days`;
  }

  getProgress(paid: number, total: number): number {
    if (total === 0) return 0;
    const progress = (paid / total) * 100;
    return Math.min(Math.round(progress), 100);
  }

  // ============================================
  // 🎨 Helpers
  // ============================================

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg, #4F46E5, #7C3AED)',
      'linear-gradient(135deg, #EC4899, #F43F5E)',
      'linear-gradient(135deg, #10B981, #059669)',
      'linear-gradient(135deg, #F59E0B, #D97706)',
      'linear-gradient(135deg, #3B82F6, #2563EB)',
      'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    ];
    
    if (!name) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  // ============================================
  // 🎯 Status Helpers
  // ============================================

  getStatusColor(status: string): string {
    const colors = {
      'closed': 'success',
      'open': 'primary',
      'pending': 'warning'
    };
    return colors[status as keyof typeof colors] || 'medium';
  }

  getStatusIcon(status: string): string {
    const icons = {
      'closed': 'checkmark-circle',
      'open': 'time',
      'pending': 'hourglass'
    };
    return icons[status as keyof typeof icons] || 'help-circle';
  }
}