redis-server &
./opa run --server --addr :8181 --set=decision_logs.console=true ./cvat/apps/iam/rules