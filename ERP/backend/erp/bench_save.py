from erp.models import PurchaseOrder
from django.db import connection, reset_queries
import time

po = PurchaseOrder.objects.get(po_number="TEST-PO-001")
po.status = PurchaseOrder.Status.CONFIRMED

for i in range(3):
    reset_queries()
    t0 = time.perf_counter()
    po.save()
    elapsed = (time.perf_counter() - t0) * 1000
    print(f"run {i}: {elapsed:.1f} ms, {len(connection.queries)} queries")

print("items:", po.po_items.count())