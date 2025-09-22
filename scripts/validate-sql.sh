#!/bin/bash

# SQL Validation Script
# This script validates SQL syntax in initialization scripts

echo "🔍 Validating SQL Scripts"
echo "========================"

# Function to validate SQL files with basic syntax checking
validate_sql_file() {
    local file="$1"
    echo "📄 Checking: $(basename "$file")"

    # Basic syntax validation
    if grep -q "CREATE\|ALTER\|GRANT\|SELECT" "$file"; then
        echo "   ✅ Contains SQL statements"
    else
        echo "   ⚠️  No SQL statements found"
    fi

    # Check for common syntax errors
    local errors=0

    # Check for unmatched quotes
    if [ $(($(grep -o "'" "$file" | wc -l) % 2)) -ne 0 ]; then
        echo "   ❌ Unmatched single quotes"
        errors=$((errors + 1))
    fi

    # Check for unmatched parentheses
    local open_parens=$(grep -o "(" "$file" | wc -l)
    local close_parens=$(grep -o ")" "$file" | wc -l)
    if [ $open_parens -ne $close_parens ]; then
        echo "   ❌ Unmatched parentheses (open: $open_parens, close: $close_parens)"
        errors=$((errors + 1))
    fi

    # Check for SQL keywords are properly capitalized
    if grep -q "create\|alter\|grant\|select" "$file"; then
        echo "   ⚠️  Some SQL keywords might not be capitalized"
    fi

    if [ $errors -eq 0 ]; then
        echo "   ✅ Basic validation passed"
    else
        echo "   ❌ $errors potential issues found"
    fi

    echo ""
}

# Main validation
echo "Validating initialization scripts..."
echo ""

# Check main database init scripts
if [ -d "scripts/init-db" ]; then
    echo "📁 Main database initialization scripts:"
    for file in scripts/init-db/*.sql; do
        if [ -f "$file" ]; then
            validate_sql_file "$file"
        fi
    done
else
    echo "❌ scripts/init-db directory not found"
fi

# Check test database init scripts
if [ -d "scripts/test-init-db" ]; then
    echo "📁 Test database initialization scripts:"
    for file in scripts/test-init-db/*.sql; do
        if [ -f "$file" ]; then
            validate_sql_file "$file"
        fi
    done
else
    echo "❌ scripts/test-init-db directory not found"
fi

echo "✅ Validation completed"