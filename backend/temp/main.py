from core import DEFAULT_CONFIG, run_test

def menu():
    cfg = DEFAULT_CONFIG.copy()

    print("=== RIFE FULL GPU + OUTPUT TEST ===")
    print("Models: 0=baseline | 1=WMS | 2=WMS_custom\n")

    inp = input("Models (comma, default 0,1,2): ").strip()
    if inp:
        cfg["models"] = [int(x) for x in inp.split(",")]

    inp = input("Mid factors (comma, default 2): ").strip()
    if inp:
        cfg["mid_factors"] = [int(x) for x in inp.split(",")]

    inp = input("Repeat runs (default 1): ").strip()
    if inp:
        cfg["repeat_runs"] = max(1, int(inp))

    print("\nFinal Config:")
    for k, v in cfg.items():
        print(f"  {k}: {v}")

    if input("\nRun test? [y/N]: ").lower() == "y":
        run_test(cfg)
    else:
        print("Aborted.")

if __name__ == "__main__":
    menu()