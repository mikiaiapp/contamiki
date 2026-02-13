      props.push({
        id: generateId(),
        date: formattedDate,
        description: concept,
        amount: amount,
        accountId: importAccount, 
        categoryId: findSuggestedCategory(concept),
        type: amount < 0 ? 'EXPENSE' : 'INCOME',
        isValidated: false,
        isDuplicate: isDuplicate
      });
    });
    setProposedTransactions(props);
    
    // Modificación: No seleccionar nada por defecto, el usuario elige manualmente
    setSelectedImportIds(new Set());
    
    setImportStep(3);
  };