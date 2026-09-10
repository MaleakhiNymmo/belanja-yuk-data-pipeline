export interface DashboardSummary {
  total_gross_revenue: number;
  total_net_revenue: number;
  total_gross_profit: number;
  total_net_profit: number;
  overall_net_margin_percentage: number;
  total_orders: number;
  total_completed_orders: number;
  total_units_sold: number;
  preserved_guest_revenue: number;
  registered_customers_count: number;
  active_products_count: number;
}

export interface PipelineMetadata {
  orchestrator: string;
  dwh: string;
  transform_engine: string;
  dbt_tests_passed: number;
  dbt_tests_total: number;
  pytest_unit_tests_passed: number;
  pytest_unit_tests_total: number;
  ci_cd_status: string;
  last_dag_run: string;
  dag_name: string;
  quality_gate_status: string;
}

export interface DailySalesItem {
  order_date: string;
  category: string;
  payment_method: string;
  channel: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_units_sold: number;
  gross_revenue_idr: number;
  net_revenue_idr: number;
  total_cogs_idr: number;
  gross_profit_idr: number;
  net_profit_idr: number;
  net_profit_margin_percentage: number;
}

export interface ProductItem {
  product_id: string;
  sku: string;
  product_name: string;
  category: string;
  price_idr: number;
  cost_idr: number;
  unit_margin_idr: number;
  margin_percentage: number;
  stock_qty: number;
  is_active: boolean;
  total_completed_orders: number;
  total_units_sold: number;
  total_revenue_generated_idr: number;
  total_profit_generated_idr: number;
  stock_status: string;
}

export interface CustomerTierItem {
  customer_tier: string;
  customer_count: number;
  total_gross_spend: number;
  total_net_spend: number;
}

export interface KimballAuditItem {
  is_registered_customer: boolean;
  label: string;
  total_items: number;
  total_revenue: number;
  total_profit: number;
  percentage: number;
  impact_note?: string;
}

export interface DashboardData {
  generated_at: string;
  source: string;
  summary: DashboardSummary;
  pipeline_metadata: PipelineMetadata;
  daily_sales: DailySalesItem[];
  products: ProductItem[];
  customer_tiers: CustomerTierItem[];
  kimball_audit: KimballAuditItem[];
}
