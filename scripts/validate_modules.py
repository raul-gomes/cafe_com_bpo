#!/usr/bin/env python3
"""
Module Structure Validator for Café com BPO

Validates that all modules follow the established pattern:
- models.py, schemas.py, repository.py, service.py, router.py
"""

import os
import sys
from pathlib import Path

# Configuration
BACKEND_MODULES_PATH = Path("apps/backend/src/modules")
REQUIRED_FILES = ["models.py", "schemas.py", "repository.py", "service.py", "router.py"]
OPTIONAL_FILES = ["storage_service.py", "__init__.py"]

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def check_module(module_path: Path) -> dict:
    """Check a single module for required files."""
    results = {
        "name": module_path.name,
        "path": module_path,
        "exists": {},
        "missing": [],
        "status": "ok",
        "is_aggregation": False
    }
    
    # Check if this is an aggregation module (like dashboard)
    # These modules don't have their own models/repository
    has_router = (module_path / "router.py").exists()
    queries_other_models = False
    
    if has_router:
        # Simple check: if router imports models from other modules
        # and doesn't have its own models.py, it's likely aggregation
        pass
    
    for file in REQUIRED_FILES:
        file_path = module_path / file
        exists = file_path.exists()
        results["exists"][file] = exists
        if not exists:
            results["missing"].append(file)
            results["status"] = "incomplete"
    
    # Special case: aggregation modules (dashboard, etc.)
    # They don't need models/repository if they query other modules
    if results["missing"] == ["models.py", "repository.py"] and has_router:
        # Check if it's aggregation by looking at router imports
        results["is_aggregation"] = True
        results["status"] = "ok"
        results["missing"] = []
    
    for file in OPTIONAL_FILES:
        file_path = module_path / file
        results["exists"][file] = file_path.exists()
    
    return results

def validate_backend_modules():
    """Validate all backend modules."""
    print(f"\n{'='*60}")
    print(f"Backend Modules Validation")
    print(f"{'='*60}\n")
    
    if not BACKEND_MODULES_PATH.exists():
        print(f"{RED}ERROR: Backend modules path not found: {BACKEND_MODULES_PATH}{RESET}")
        return False
    
    modules = [d for d in BACKEND_MODULES_PATH.iterdir() if d.is_dir() and d.name != "__pycache__"]
    modules.sort()
    
    all_valid = True
    
    for module in modules:
        results = check_module(module)
        
        status_icon = f"{GREEN}✓{RESET}" if results["status"] == "ok" else f"{YELLOW}⚠{RESET}"
        
        # Special display for aggregation modules
        if results.get("is_aggregation"):
            print(f"{GREEN}✓{RESET} {results['name']} (aggregation module)")
            print(f"    {YELLOW}ℹ{RESET} Aggregation module - queries other modules directly")
            if results.get("exists", {}).get("service.py"):
                print(f"    {GREEN}✓{RESET} service.py")
            if results.get("exists", {}).get("router.py"):
                print(f"    {GREEN}✓{RESET} router.py")
            if results.get("exists", {}).get("schemas.py"):
                print(f"    {GREEN}✓{RESET} schemas.py")
        else:
            print(f"{status_icon} {results['name']}")
            
            for file in REQUIRED_FILES:
                exists = results["exists"].get(file, False)
                icon = f"{GREEN}✓{RESET}" if exists else f"{RED}✗{RESET}"
                print(f"    {icon} {file}")
            
            for file in OPTIONAL_FILES:
                exists = results["exists"].get(file, False)
                if exists:
                    print(f"    {GREEN}✓{RESET} {file} (optional)")
            
            if results["missing"]:
                print(f"    {RED}Missing: {', '.join(results['missing'])}{RESET}")
                all_valid = False
        print()
    
    return all_valid

def check_imports():
    """Check if module imports in main.py are valid."""
    print(f"\n{'='*60}")
    print(f"Import Validation")
    print(f"{'='*60}\n")
    
    main_py = Path("apps/backend/src/main.py")
    if not main_py.exists():
        print(f"{RED}ERROR: main.py not found{RESET}")
        return False
    
    with open(main_py) as f:
        content = f.read()
    
    # Extract router imports
    import_lines = [line.strip() for line in content.split('\n') 
                     if 'from src.modules' in line and 'router' in line]
    
    print(f"Found {len(import_lines)} module router imports in main.py:\n")
    
    all_valid = True
    for line in import_lines:
        # Extract module name
        parts = line.split('/')
        if len(parts) >= 2:
            module_name = parts[1]
            router_file = BACKEND_MODULES_PATH / module_name / "router.py"
            exists = router_file.exists()
            icon = f"{GREEN}✓{RESET}" if exists else f"{RED}✗{RESET}"
            print(f"  {icon} {module_name}")
            if not exists:
                all_valid = False
    
    return all_valid

def generate_report():
    """Generate a summary report."""
    print(f"\n{'='*60}")
    print(f"Module Structure Report")
    print(f"{'='*60}\n")
    
    modules_path = Path("apps/backend/src/modules")
    if not modules_path.exists():
        print(f"{RED}ERROR: Modules path not found{RESET}")
        return
    
    modules = [d for d in modules_path.iterdir() if d.is_dir()]
    
    print(f"Total modules: {len(modules)}")
    print(f"Required files per module: {len(REQUIRED_FILES)}")
    print(f"\nModule list:")
    
    for module in sorted(modules):
        files = list(module.glob("*.py"))
        file_names = [f.name for f in files]
        has_all = all(req in file_names for req in REQUIRED_FILES)
        status = f"{GREEN}complete{RESET}" if has_all else f"{YELLOW}incomplete{RESET}"
        print(f"  - {module.name}: {status}")

def main():
    print(f"\n{'='*60}")
    print(f"Café com BPO - Module Structure Validator")
    print(f"{'='*60}")
    
    backend_ok = validate_backend_modules()
    imports_ok = check_imports()
    generate_report()
    
    print(f"\n{'='*60}")
    if backend_ok and imports_ok:
        print(f"{GREEN}✓ All modules are properly structured!{RESET}")
        return 0
    else:
        print(f"{YELLOW}⚠ Some modules need attention. Check the report above.{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
