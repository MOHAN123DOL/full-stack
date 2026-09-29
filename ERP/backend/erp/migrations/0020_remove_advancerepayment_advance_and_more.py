from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("erp", "0019_salaryadjustment"),
    ]

    operations = [
        migrations.DeleteModel(
            name="AdvanceRepayment",
        ),
        migrations.DeleteModel(
            name="Advance",
        ),
        migrations.DeleteModel(
            name="Attendance",
        ),
        migrations.DeleteModel(
            name="SalaryAdjustment",
        ),
        migrations.DeleteModel(
            name="SalaryPayment",
        ),
        migrations.DeleteModel(
            name="WageConfig",
        ),
    ]